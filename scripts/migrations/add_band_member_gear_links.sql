-- Arbitrary social/website links for band members and individual gear items.
-- Same shape as site_settings.footer_links ({text, url} pairs) — see
-- scripts/migrations/add_footer_links.sql — reused here instead of fixed
-- instagram_url/website_url-style columns since gear needs open-ended link
-- types (e.g. "Manufacturer page"), not a fixed social set.
ALTER TABLE public.band_members ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb;
