-- Mid-size (1200px) display copy of each poster/photo, shown on show pages
-- instead of the full-size original. Nullable: the client falls back to the
-- original when it's missing. Populated on upload (routes/posters.js,
-- routes/photos.js) and for existing rows by scripts/backfill_display_images.js.
ALTER TABLE public.user_posters ADD COLUMN IF NOT EXISTS display_url TEXT;
ALTER TABLE public.user_photos ADD COLUMN IF NOT EXISTS display_url TEXT;
