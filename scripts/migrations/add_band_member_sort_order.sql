-- Lets an admin manually order the band roster (e.g. matching stage lineup
-- or seniority) instead of the alphabetical default. Mirrors
-- link_categories.sort_order (scripts/migrations/add_links_and_categories.sql).

ALTER TABLE public.band_members ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows with a stable initial order (current alphabetical
-- display order) so the list isn't all-zeros before anyone reorders it.
WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn FROM public.band_members
)
UPDATE public.band_members bm
SET sort_order = ordered.rn
FROM ordered
WHERE bm.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_band_members_sort_order ON public.band_members(sort_order);
