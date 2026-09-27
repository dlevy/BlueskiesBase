-- Migration: Add thumbnail_url to user_posters and user_photos
-- Description: Gallery grids (Posters page, Photos page, and the small photo-strip
-- on a show's Photos section) were loading full-resolution images just to render
-- small tiles, driving egress. New uploads generate a separate small derivative;
-- existing rows are backfilled by scripts/backfill_thumbnails.js. NULL means no
-- thumbnail yet — callers fall back to the full-size url.

ALTER TABLE public.user_posters
ADD COLUMN thumbnail_url TEXT;

ALTER TABLE public.user_photos
ADD COLUMN thumbnail_url TEXT;

COMMENT ON COLUMN public.user_posters.thumbnail_url IS 'Small derived image for gallery grids; NULL = not yet generated, fall back to poster_url';
COMMENT ON COLUMN public.user_photos.thumbnail_url IS 'Small derived image for gallery grids; NULL = not yet generated, fall back to photo_url';
