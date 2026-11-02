-- Widens notifications.type to support 'photo_report': a logged-in user
-- flagging a photo as inaccurate or inappropriate. No new table — the
-- report itself lives entirely as a notification row per admin/editor
-- recipient (type: 'photo_report', content_type: 'photo', content_id ->
-- user_photos.id, message carries the reason and optional note). Looks up
-- the CHECK constraint by column rather than by name, same as the other
-- notification-type migrations, since Postgres auto-names them
-- unpredictably.
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
    CHECK (type IN ('thanks','show_update','mention','submission','poster_interest','photo_report'));
