-- Lets an admin manually order a band member's gear list (e.g. matching the
-- order they'd want it shown publicly) instead of insertion order. Mirrors
-- band_members.sort_order (scripts/migrations/add_band_member_sort_order.sql).

ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows with a stable initial order (current creation
-- order, per member) so the list isn't all-zeros before anyone reorders it.
WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY band_member_id ORDER BY created_at) AS rn
    FROM public.gear_items
)
UPDATE public.gear_items gi
SET sort_order = ordered.rn
FROM ordered
WHERE gi.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_gear_items_sort_order ON public.gear_items(sort_order);
