-- Removes the manual "sold out" flag added in add_poster_drop_sold_out.sql —
-- simplified back to a pure time-based rule: a poster drop just disappears
-- from the Posters page 24 hours after it happens, no manual flag needed.

ALTER TABLE public.user_posters DROP COLUMN IF EXISTS drop_sold_out;
