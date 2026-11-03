-- Adds a community forum: admin-managed categories, each holding member-
-- started threads, each thread holding replies. A thread holds its own
-- opening post (title + body) rather than being a bare title with a
-- separate "reply #0", so creating a thread is a single form like ShowForm.
-- A deleted category orphans its threads to category_id = NULL, shown in an
-- "Other" bucket on the public page — same fallback the Links page already
-- uses for link_categories.
CREATE TABLE IF NOT EXISTS forum_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES forum_categories(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) <= 200),
    body TEXT NOT NULL CHECK (char_length(body) <= 5000),
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(body) <= 5000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_category_id ON forum_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_user_id ON forum_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_last_activity ON forum_threads(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_thread_id ON forum_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_user_id ON forum_replies(user_id);

ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read forum_categories" ON forum_categories FOR SELECT TO public USING (true);
CREATE POLICY "Public read forum_threads" ON forum_threads FOR SELECT TO public USING (true);
CREATE POLICY "Public read forum_replies" ON forum_replies FOR SELECT TO public USING (true);

-- Defensive only — real authZ is server-side requireAdmin/authenticate
-- middleware in server/routes/forum.js; the Express backend uses the
-- Supabase service-role key and bypasses RLS entirely.
CREATE POLICY "Admins manage forum_categories" ON forum_categories FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Members manage own forum_threads" ON forum_threads FOR ALL TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'editor')));
CREATE POLICY "Members manage own forum_replies" ON forum_replies FOR ALL TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'editor')));

COMMENT ON TABLE forum_categories IS 'Admin-managed categories grouping forum threads on the public /forum page';
COMMENT ON TABLE forum_threads IS 'A forum thread — its own opening post (title + body) plus moderation flags';
COMMENT ON TABLE forum_replies IS 'A reply to a forum thread';
COMMENT ON COLUMN forum_threads.category_id IS 'Nullable FK to forum_categories — a thread whose category is deleted falls into the "Other" bucket on the public page';
COMMENT ON COLUMN forum_threads.last_activity_at IS 'Bumped on every new reply; threads list sorts by this, not created_at';

-- Widen notifications.type/content_type for forum_reply (new reply on a
-- thread you're a participant of) and forum_report (staff moderation queue
-- — no dedicated report table, the notification row IS the report, same
-- shape as photo_report). Looks up each CHECK constraint by column rather
-- than by name, same as every other notification-type migration, since
-- Postgres auto-names them unpredictably.
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
    CHECK (type IN ('thanks','show_update','mention','submission','poster_interest','photo_report','forum_reply','forum_report'));

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
    CHECK (content_type IN ('photo','poster','note','setlist_submission','setlist','poster_collection','forum_thread','forum_reply'));
