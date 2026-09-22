-- Migration: Add favorite_show_id / favorite_venue_id to profiles table
-- Description: Replaces the auto-computed "favorite venue/city" on the public
--              profile with user-picked favorites, selected from among the shows
--              they've actually attended (validated server-side on save, not just
--              in the UI). ON DELETE SET NULL so removing a show/venue from the
--              catalog never blocks that deletion or leaves a dangling reference.

ALTER TABLE public.profiles
ADD COLUMN favorite_show_id UUID REFERENCES public.shows(id) ON DELETE SET NULL,
ADD COLUMN favorite_venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.favorite_show_id IS 'Opt-in: a show the user picked as their favorite, must be one they attended (validated on save)';
COMMENT ON COLUMN public.profiles.favorite_venue_id IS 'Opt-in: a venue the user picked as their favorite, must be one they attended a show at (validated on save)';
