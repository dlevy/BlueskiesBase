-- Band Members & Gear: Sturgill Simpson's own band lineup (distinct from the
-- `bands` table, which is just id+name for show "opened for" attribution)
-- and the gear each member uses.

CREATE TABLE IF NOT EXISTS public.band_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    photo_url TEXT,
    bio TEXT,
    roles TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_updated_at_band_members BEFORE UPDATE ON public.band_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A member's time in the band — its own table (not start/end columns on
-- band_members) because a member can leave and rejoin, needing more than
-- one date range.
CREATE TABLE IF NOT EXISTS public.band_member_tenures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_member_id UUID NOT NULL REFERENCES public.band_members(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,  -- NULL = currently active
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT band_member_tenures_date_order CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_band_member_tenures_member ON public.band_member_tenures(band_member_id);
-- At most one "currently active" tenure per member — mirrors the partial
-- unique index already used for poster_show_links' primary-slot rule.
CREATE UNIQUE INDEX idx_band_member_tenures_one_current
    ON public.band_member_tenures(band_member_id) WHERE end_date IS NULL;

-- Gear belongs to exactly one member — a plain foreign key, not a join
-- table. Single date range only (no re-retire/re-acquire history); dates
-- are optional since exact acquisition dates often aren't known.
CREATE TABLE IF NOT EXISTS public.gear_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_member_id UUID NOT NULL REFERENCES public.band_members(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    make TEXT,
    model TEXT,
    year INTEGER,
    notes TEXT,
    photo_url TEXT,
    start_date DATE,
    end_date DATE,  -- NULL = currently in use
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT gear_items_category_check CHECK (category IN ('guitar', 'bass', 'amp', 'pedal', 'drums', 'keys', 'vocals_mic', 'other')),
    CONSTRAINT gear_items_date_order CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_gear_items_member ON public.gear_items(band_member_id);
CREATE TRIGGER set_updated_at_gear_items BEFORE UPDATE ON public.gear_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_member_tenures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read band_members" ON public.band_members FOR SELECT TO public USING (true);
CREATE POLICY "Public read band_member_tenures" ON public.band_member_tenures FOR SELECT TO public USING (true);
CREATE POLICY "Public read gear_items" ON public.gear_items FOR SELECT TO public USING (true);

-- Defensive only, matching schema.sql's convention — real authZ is
-- server-side (Express connects via the service-role key, bypassing RLS).
CREATE POLICY "Editors manage band_members" ON public.band_members FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('editor', 'admin')));
CREATE POLICY "Editors manage band_member_tenures" ON public.band_member_tenures FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('editor', 'admin')));
CREATE POLICY "Editors manage gear_items" ON public.gear_items FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('editor', 'admin')));

COMMENT ON TABLE public.band_members IS 'Sturgill Simpson''s own band lineup, distinct from the bands table (which is just id+name for show opener attribution).';
COMMENT ON COLUMN public.band_member_tenures.end_date IS 'NULL = currently active in the band.';
COMMENT ON COLUMN public.gear_items.end_date IS 'NULL = currently in use.';
