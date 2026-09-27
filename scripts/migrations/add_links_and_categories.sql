-- Migration: Add link categories and links tables
-- Description: Supports a public /links directory of external JBS-affiliated
-- sites (news, video channels, communities, poster artists), grouped into
-- admin-manageable categories. Categories are fully runtime-editable (not
-- hardcoded) so editors/admins can add/rename/reorder/delete them without a
-- deploy. Links whose category is deleted fall back to an "Other" bucket on
-- the public page, mirroring the songs.album_id nullable-FK pattern.

CREATE TABLE IF NOT EXISTS link_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES link_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_links_category_id ON links(category_id);

-- Seed the four confirmed categories, in display order
INSERT INTO link_categories (name, sort_order) VALUES
    ('News Articles', 1),
    ('Video Channels', 2),
    ('Communities', 3),
    ('Poster Artists', 4)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE link_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read link_categories" ON link_categories FOR SELECT TO public USING (true);
CREATE POLICY "Public read links" ON links FOR SELECT TO public USING (true);

-- Defensive only — real authZ is server-side requireEditorOrAdmin/requireAdmin
-- middleware; the Express backend uses the Supabase service-role key and
-- bypasses RLS entirely.
CREATE POLICY "Editors and admins manage link_categories" ON link_categories FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'editor')));
CREATE POLICY "Editors and admins manage links" ON links FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'editor')));

COMMENT ON TABLE link_categories IS 'Admin-managed categories grouping external JBS-affiliated links on the public /links page';
COMMENT ON TABLE links IS 'External links (news, videos, communities, poster artists) shown on the public /links page';
COMMENT ON COLUMN links.category_id IS 'Nullable FK to link_categories — a link whose category is deleted falls into the "Other" bucket on the public page';
