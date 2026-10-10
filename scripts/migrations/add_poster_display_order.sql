-- Lets a show's additional (non-primary) posters be put in a specific
-- display order — previously they just showed in whatever order Supabase
-- happened to return the poster_show_links join in, with no admin control.

ALTER TABLE public.user_posters ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
