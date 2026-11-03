-- Lets a member "like" (thanks) a forum thread or reply — reuses the
-- existing polymorphic thanks table rather than a new one, same as every
-- other likeable content type (photo/poster/note/setlist_submission).
-- Quoting a post in a reply needs no schema change at all — it's just
-- plain text with a "> " prefix convention, rendered specially client-side.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT con.conname FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'thanks' AND con.contype = 'c' AND att.attname = 'content_type'
    LOOP
        EXECUTE format('ALTER TABLE public.thanks DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;
ALTER TABLE public.thanks ADD CONSTRAINT thanks_content_type_check
    CHECK (content_type IN ('photo', 'poster', 'note', 'setlist_submission', 'forum_thread', 'forum_reply'));
