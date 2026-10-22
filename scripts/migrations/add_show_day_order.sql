-- Lets two or more shows that share the exact same show_date (e.g. an
-- official show and its same-night afterparty) be put in a deliberate
-- order instead of whatever order they happen to come back in. Lower
-- values come first; defaults to 0, so a date with only one show never
-- needs to think about this at all.
--
-- day_order is a coarse time-of-day ordinal, so it moves WITH show_date's
-- own sort direction, not always ascending: a chronological (ascending)
-- list sorts day_order ascending too (the main show before its later-that-
-- night afterparty), while a most-recent-first (descending) list sorts
-- day_order descending (the afterparty — later in the day — counts as
-- more recent than the main show on the same date). Every query that
-- lists shows by date also sorts by this as a secondary key in whichever
-- direction matches, so the order set here is followed everywhere shows
-- are listed, including previous/next navigation on the show page.

ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS day_order INTEGER NOT NULL DEFAULT 0;
