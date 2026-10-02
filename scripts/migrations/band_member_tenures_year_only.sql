-- Tenure periods only need a year of precision ("joined in 2013"), not a
-- full date — switches start_date/end_date (DATE) to start_year/end_year
-- (INTEGER). Gear's dates are untouched; this is tenure-only.

ALTER TABLE public.band_member_tenures ADD COLUMN IF NOT EXISTS start_year INTEGER;
ALTER TABLE public.band_member_tenures ADD COLUMN IF NOT EXISTS end_year INTEGER;

UPDATE public.band_member_tenures SET start_year = EXTRACT(YEAR FROM start_date)::INTEGER WHERE start_date IS NOT NULL;
UPDATE public.band_member_tenures SET end_year = EXTRACT(YEAR FROM end_date)::INTEGER WHERE end_date IS NOT NULL;

ALTER TABLE public.band_member_tenures ALTER COLUMN start_year SET NOT NULL;

DROP INDEX IF EXISTS idx_band_member_tenures_one_current;
ALTER TABLE public.band_member_tenures DROP CONSTRAINT IF EXISTS band_member_tenures_date_order;

ALTER TABLE public.band_member_tenures DROP COLUMN IF EXISTS start_date;
ALTER TABLE public.band_member_tenures DROP COLUMN IF EXISTS end_date;

ALTER TABLE public.band_member_tenures ADD CONSTRAINT band_member_tenures_year_order CHECK (end_year IS NULL OR end_year >= start_year);

-- Recreated against end_year — same "at most one currently-active tenure
-- per member" rule as before.
CREATE UNIQUE INDEX idx_band_member_tenures_one_current
    ON public.band_member_tenures(band_member_id) WHERE end_year IS NULL;

COMMENT ON COLUMN public.band_member_tenures.end_year IS 'NULL = currently active in the band.';
