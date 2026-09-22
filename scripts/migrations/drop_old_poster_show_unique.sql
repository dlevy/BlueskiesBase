-- Migration: Drop the old one-poster-per-show constraint
-- Description: A pre-existing UNIQUE(show_id) constraint on user_posters (from
--              before this repo's tracked migrations — not present in
--              database/schema.sql) still enforced "one poster per show" even
--              after add_poster_foil_variant.sql added the (show_id, is_foil)
--              constraint meant to replace it. That older constraint has to go,
--              or a show can still never get a second (foil) poster row.

ALTER TABLE public.user_posters
DROP CONSTRAINT user_posters_show_id_key;
