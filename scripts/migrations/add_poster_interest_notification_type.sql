-- Adds a free-text message column to notifications (needed to carry a
-- buyer/seller's note), and widens the type/content_type CHECK constraints
-- to support poster-trade correspondence: type 'poster_interest' and
-- content_type 'poster_collection' (content_id -> user_poster_collection.id
-- — deliberately distinct from the existing 'poster' content_type, which
-- always means content_id -> user_posters.id elsewhere).
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;

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
    CHECK (type IN ('thanks','show_update','mention','submission','poster_interest'));

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
    CHECK (content_type IN ('photo','poster','note','setlist_submission','setlist','poster_collection'));
