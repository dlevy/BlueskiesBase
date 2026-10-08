-- Repurposes the old fixed "Follow @jbssetlists" banner (which had a
-- per-visitor dismiss button) into an admin-editable site-wide announcement
-- bar: no close button anymore, so an `enabled` toggle is how an admin
-- turns it off instead. Text is stored as three parts (prefix / linked
-- phrase + URL / suffix) rather than free-form markup, so the hyperlinked
-- portion is always a plain substring — simple to edit, no HTML-injection
-- surface to worry about.
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS banner JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "prefixText": "Follow",
    "linkText": "@jbssetlists",
    "linkUrl": "https://www.instagram.com/jbssetlists/",
    "suffixText": "for face-melting setlists to your IG feed.",
    "color": "#fbbf24"
}'::jsonb;
