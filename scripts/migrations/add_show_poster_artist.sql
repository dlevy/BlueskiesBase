-- Migration: Add poster artist credit fields to shows table
-- Description: Lets an editor/admin credit the artist who designed a show's
-- poster, with an optional link to their site/store. Displayed on the show
-- page and as a tooltip on the Posters gallery page.

ALTER TABLE public.shows
ADD COLUMN poster_artist_name TEXT,
ADD COLUMN poster_artist_url TEXT;

ALTER TABLE public.shows
ADD CONSTRAINT shows_poster_artist_name_length CHECK (char_length(poster_artist_name) <= 200);

ALTER TABLE public.shows
ADD CONSTRAINT shows_poster_artist_url_length CHECK (char_length(poster_artist_url) <= 300);

COMMENT ON COLUMN public.shows.poster_artist_name IS 'Name of the artist/designer credited for this show''s poster; NULL = no credit set';
COMMENT ON COLUMN public.shows.poster_artist_url IS 'Optional link to the poster artist''s site/store; NULL = no link';
