-- Moves poster artist credit from `shows` (per-show) onto `user_posters`
-- (per-poster, canonical, mirroring is_foil/is_primary) so a poster's credit
-- travels with it automatically when linked to more shows via
-- poster_show_links, instead of having to be re-entered on every show.

ALTER TABLE public.user_posters ADD COLUMN IF NOT EXISTS poster_artist_name TEXT;
ALTER TABLE public.user_posters ADD COLUMN IF NOT EXISTS poster_artist_url TEXT;
ALTER TABLE public.user_posters ADD CONSTRAINT user_posters_poster_artist_name_length CHECK (char_length(poster_artist_name) <= 200);
ALTER TABLE public.user_posters ADD CONSTRAINT user_posters_poster_artist_url_length CHECK (char_length(poster_artist_url) <= 300);

-- Backfill: every user_posters row has at least one poster_show_links row
-- (created at upload time). Pull the credit from whichever linked show has
-- it set, preferring the earliest show_date for determinism when more than
-- one linked show happens to have a (consistent) value.
UPDATE public.user_posters up
SET poster_artist_name = src.poster_artist_name,
    poster_artist_url = src.poster_artist_url
FROM (
    SELECT DISTINCT ON (psl.poster_id)
        psl.poster_id, s.poster_artist_name, s.poster_artist_url
    FROM public.poster_show_links psl
    JOIN public.shows s ON s.id = psl.show_id
    WHERE s.poster_artist_name IS NOT NULL
    ORDER BY psl.poster_id, s.show_date ASC
) src
WHERE src.poster_id = up.id;

-- Diagnostic only (not applied automatically) — run this separately after
-- the backfill to confirm no poster's linked shows actually disagreed on a
-- non-null credit (which the DISTINCT ON above would have silently resolved
-- by picking the earliest show's value):
--
-- SELECT psl.poster_id, array_agg(DISTINCT s.poster_artist_name) AS names, array_agg(DISTINCT s.poster_artist_url) AS urls
-- FROM public.poster_show_links psl
-- JOIN public.shows s ON s.id = psl.show_id
-- WHERE s.poster_artist_name IS NOT NULL
-- GROUP BY psl.poster_id
-- HAVING COUNT(DISTINCT s.poster_artist_name) > 1 OR COUNT(DISTINCT s.poster_artist_url) > 1;

-- shows.poster_artist_name/url are intentionally left in place (unused by
-- the app going forward) as a zero-risk safety net over the original data.
