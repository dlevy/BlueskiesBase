-- profiles.id -> auth.users(id) had no ON DELETE behavior (defaults to NO ACTION),
-- so deleting an auth user via supabase.auth.admin.deleteUser() silently failed
-- with a foreign-key violation as long as their profiles row still existed. Every
-- other user-owned table (user_shows, user_notes, etc.) already cascades from
-- profiles.id, so fixing this one FK is enough to make account deletion fully
-- cascade end-to-end.
--
-- Written as a DO block (rather than a fixed constraint name) since the original
-- constraint was created as an inline column REFERENCES with no explicit name, and
-- its auto-generated name isn't guaranteed.

DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT con.conname INTO fk_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'profiles'
      AND con.contype = 'f'
      AND con.confrelid = 'auth.users'::regclass
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', fk_name);
    END IF;

    ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;
