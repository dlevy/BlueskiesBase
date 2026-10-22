-- Lets two or more shows that share the exact same show_date (e.g. an
-- official show and its same-night afterparty) be put in a deliberate
-- order instead of whatever order they happen to come back in. Lower
-- values come first; defaults to 0, so a date with only one show never
-- needs to think about this at all. Every query that lists shows by date
-- now also sorts by this as a secondary key, so the order set here is
-- followed everywhere shows are listed, including previous/next
-- navigation on the show page.

ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS day_order INTEGER NOT NULL DEFAULT 0;
