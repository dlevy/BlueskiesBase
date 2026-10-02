-- Footer items replace the old hardcoded credits row: up to 8 {text, url}
-- entries (url optional — a plain-text credit like "Created and maintained
-- by Daniel Levy" has none), rendered 4-per-row across up to 2 rows.
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS footer_links JSONB NOT NULL DEFAULT '[
    {"text": "Created and maintained by Daniel Levy", "url": null},
    {"text": "Initial setlist import thanks to Setlist.fm", "url": "https://www.setlist.fm"},
    {"text": "Inspired by crowesbase.com", "url": "https://www.crowesbase.com"}
]'::jsonb;

ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_footer_links_max_8
    CHECK (jsonb_array_length(footer_links) <= 8);
