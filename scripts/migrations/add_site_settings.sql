-- Migration: Add site_settings singleton table
-- Description: Site-wide editable text, currently just the header
-- title/subtitle shown on every page (previously hardcoded in App.jsx).
-- Singleton pattern: id is always `true`, enforced as the primary key so
-- there can only ever be exactly one row.

CREATE TABLE IF NOT EXISTS public.site_settings (
    id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    header_title TEXT NOT NULL DEFAULT 'Skysets.org - JBS / Sturgill Simpson Media Archive',
    header_subtitle TEXT NOT NULL DEFAULT 'Johnny Blue Skies & The Dark Clouds Concert Setlist Archive',
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO public.site_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_settings" ON public.site_settings FOR SELECT TO public USING (true);
-- Defensive only — real authZ is server-side requireAdmin (Express uses the
-- service-role key and bypasses RLS entirely).
CREATE POLICY "Admins manage site_settings" ON public.site_settings FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

COMMENT ON TABLE public.site_settings IS 'Singleton row (id always true) of site-wide editable text — currently the header title/subtitle shown on every page.';
