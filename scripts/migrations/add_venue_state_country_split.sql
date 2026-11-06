-- venues.state_country has always been one free-text column ("Colorado,
-- United States", "CO", "Ontario, Canada", "Scotland", ...). These two new
-- columns are the clean, structured fields going forward for display and
-- search filtering. state_country itself is left alone and NOT backfilled
-- or removed here — buildShowPath() slugifies it directly into every show's
-- URL, so it must keep its exact existing value for every current venue or
-- existing /show/... links would change. See
-- scripts/backfill_venue_state_country.js for the one-time data backfill
-- that populates these two columns from the existing state_country values.
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS country TEXT;
