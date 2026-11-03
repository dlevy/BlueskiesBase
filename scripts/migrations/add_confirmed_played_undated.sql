-- Support songs that are confirmed to have been performed live (e.g. during
-- Sturgill Simpson's early Sunday Valley bar-show era) but for which no
-- dated setlist survives — distinct from a song that may genuinely never
-- have been played (performance_count === 0 with this flag left false).
ALTER TABLE songs ADD COLUMN IF NOT EXISTS confirmed_played_undated boolean NOT NULL DEFAULT false;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS undated_performance_note text;

-- Fix stray leading-space typos on a few Sunday Valley-era titles.
UPDATE songs SET title = trim(title)
WHERE title IN (' Never Go To Town Again', ' Folded Flag', ' Honky Tonk Guy', ' Old Sunshine');

-- "Tennessee" and "Panbowl" were unreleased Sunday Valley songs later
-- released by Sturgill Simpson solo — flag them as Sunday Valley like the
-- rest of that era's catalog.
UPDATE songs SET is_sunday_valley = true
WHERE trim(title) IN ('Tennessee', 'Panbowl');

-- Mark the known Sunday Valley bar-show songs as confirmed played live, even
-- though no dated setlist exists for any of them.
UPDATE songs
SET confirmed_played_undated = true,
    undated_performance_note = 'Confirmed played live during the Sunday Valley era, based on paper setlists and video footage — no documented date survives.'
WHERE trim(title) IN (
    'Jesus Boogie', 'Tennessee', 'Panbowl', 'Never Go To Town Again',
    'Cut The Sails', 'Let Me Know', 'Folded Flag', 'Honky Tonk Guy', 'Old Sunshine'
);
