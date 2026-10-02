-- Lets a show have more than one regular/foil poster — rare, but some
-- afterparty/special-run shows have additional printings beyond the
-- standard pair. is_primary distinguishes the normal regular/foil "slots"
-- (at most one of each, enforced below) from any number of additional
-- posters, which are otherwise unconstrained.

-- Canonical on user_posters, mirroring how is_foil already works (set once
-- at creation, copied onto poster_show_links at link time — never re-derived
-- from an existing link).
ALTER TABLE public.user_posters ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT true;
-- Drop the old redundant 2-variant cap from an earlier migration
-- (add_poster_foil_variant.sql) if it's still live — safe either way.
ALTER TABLE public.user_posters DROP CONSTRAINT IF EXISTS user_posters_show_variant_unique;

ALTER TABLE public.poster_show_links ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT true;

-- Replace the old blanket UNIQUE(show_id, is_foil) with a partial index
-- scoped to is_primary, so the primary regular/foil pair keeps real
-- DB-level protection against a concurrent double-upload race, while
-- additional (is_primary=false) posters are unconstrained in count.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT con.conname FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'poster_show_links' AND con.contype = 'u'
    LOOP
        EXECUTE format('ALTER TABLE public.poster_show_links DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS poster_show_links_primary_variant_unique
    ON public.poster_show_links (show_id, is_foil) WHERE is_primary;
