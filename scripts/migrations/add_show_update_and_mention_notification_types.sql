-- Widens notifications.content_type and notifications.type to support two new
-- notification kinds: 'show_update' (a show you attended got a new photo/
-- poster/comment, or a correction to its official setlist) and 'mention'
-- (someone @mentioned you in a comment), plus 'submission' (a staff-only
-- "new setlist correction awaiting review" signal). Looks up each CHECK
-- constraint by column rather than by name, since Postgres auto-names them
-- unpredictably.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT con.conname FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'notifications' AND con.contype = 'c' AND att.attname = 'content_type'
    LOOP
        EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_content_type_check
    CHECK (content_type IN ('photo','poster','note','setlist_submission','setlist'));

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT con.conname FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'notifications' AND con.contype = 'c' AND att.attname = 'type'
    LOOP
        EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('thanks','show_update','mention','submission'));
