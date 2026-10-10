-- Manual "sold out" flag for a poster's drop, replacing the old automatic
-- 24-hour display window on the Posters page's drop strip — now a drop
-- (future or already past) keeps showing until explicitly marked sold out.

ALTER TABLE public.user_posters ADD COLUMN IF NOT EXISTS drop_sold_out BOOLEAN NOT NULL DEFAULT false;
