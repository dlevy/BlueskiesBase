-- A show that was scheduled but never happened — still gets its own page
-- (posters/photos may already exist for it, people may have marked plans
-- to attend), but is never counted as "attended" or toward any
-- played-shows total. Plain boolean: the only alternate state needed today.
ALTER TABLE public.shows ADD COLUMN is_cancelled BOOLEAN NOT NULL DEFAULT false;
