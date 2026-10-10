-- Lets a poster carry its own scheduled public "AP poster drop" (date/time +
-- store URL) — typically 1-2 weeks after the show, once the poster art is
-- already known. Independent of edition_type on user_poster_collection; a
-- poster doesn't need to be an AP for its drop to be scheduled here.

ALTER TABLE public.user_posters ADD COLUMN IF NOT EXISTS drop_at TIMESTAMPTZ;
ALTER TABLE public.user_posters ADD COLUMN IF NOT EXISTS drop_url TEXT;
ALTER TABLE public.user_posters ADD CONSTRAINT user_posters_drop_url_length CHECK (char_length(drop_url) <= 500);
