-- Migration: Allow a regular + foil variant poster per show
-- Description: Adds is_foil to user_posters so each show can have up to two
--              poster rows (one regular, one foil) instead of exactly one. Adds a
--              uniqueness constraint on (show_id, is_foil) so there's still at most
--              one of each variant per show. Existing rows all default to
--              is_foil = false, which is safe against that constraint since the
--              app previously enforced one poster per show anyway.
--
--              Also drops user_poster_collection.has_foil — that flag is now
--              redundant (and could contradict the poster it points to): whether
--              a collected poster is the foil edition is a property of the poster
--              row itself (is_foil), not a separate flag on the ownership record.

ALTER TABLE public.user_posters
ADD COLUMN is_foil BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.user_posters
ADD CONSTRAINT user_posters_show_variant_unique UNIQUE (show_id, is_foil);

COMMENT ON COLUMN public.user_posters.is_foil IS 'True if this is the foil/variant edition poster for the show, as opposed to the regular edition';

ALTER TABLE public.user_poster_collection
DROP COLUMN has_foil;
