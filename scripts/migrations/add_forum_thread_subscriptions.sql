-- Migration: Add forum thread subscriptions
-- Lets any logged-in member opt in/out of "notify me on new replies" for a
-- thread, independent of whether they started it. notifyForumReply
-- (server/utils/notify.js) now sources recipients from this table instead
-- of deriving them live from forum_threads.user_id + distinct
-- forum_replies.user_id. Posting a thread or a reply auto-subscribes the
-- poster (server/routes/forum.js), so today's behavior — owner + repliers
-- get notified — is preserved by default; an explicit unsubscribe sticks
-- unless the member posts again.

CREATE TABLE IF NOT EXISTS public.forum_thread_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_thread_subscriptions_thread ON public.forum_thread_subscriptions(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_thread_subscriptions_user ON public.forum_thread_subscriptions(user_id);

ALTER TABLE public.forum_thread_subscriptions ENABLE ROW LEVEL SECURITY;

-- Unlike thanks, who's subscribed is private — no public SELECT policy.
CREATE POLICY "Users read own forum subscriptions" ON public.forum_thread_subscriptions FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Defensive only, same as thanks/notifications — Express uses the
-- service-role key and bypasses RLS entirely; real authZ lives in
-- server/routes/forum.js.
CREATE POLICY "Users manage own forum subscriptions" ON public.forum_thread_subscriptions FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.forum_thread_subscriptions IS 'Opt-in/out "notify me on new replies" per (thread, user). Backfilled once below for every existing thread''s owner+repliers; after that, explicit via POST/DELETE /api/forum/threads/:id/subscription plus auto-subscribe on posting a thread or reply.';

-- Backfill: every existing thread's owner, plus every distinct repliers'
-- user_id, so nobody who's "in" an existing conversation today silently
-- stops being notified once notifyForumReply reads from this table instead
-- of deriving live. ON CONFLICT DO NOTHING makes this (or a re-run) safe.
INSERT INTO public.forum_thread_subscriptions (thread_id, user_id)
SELECT id, user_id FROM public.forum_threads
ON CONFLICT (thread_id, user_id) DO NOTHING;

INSERT INTO public.forum_thread_subscriptions (thread_id, user_id)
SELECT DISTINCT thread_id, user_id FROM public.forum_replies
ON CONFLICT (thread_id, user_id) DO NOTHING;
