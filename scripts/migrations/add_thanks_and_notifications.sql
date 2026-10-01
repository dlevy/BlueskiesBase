-- Migration: Add thanks and notifications tables
-- Description: Lets any logged-in member say "thanks" to whoever contributed
-- a piece of show-page content (photo, poster, note, or community setlist
-- submission). Thanks counts are public; the recipient gets an in-app
-- notification surfaced via a bell icon in the header. Toggleable (thank
-- again to un-thank) rather than one-time.
--
-- `thanks` is deliberately polymorphic (content_type + content_id, no FK on
-- content_id) since the four thankable tables have no common parent. It does
-- NOT carry a show_id: a poster can be linked to multiple shows via
-- poster_show_links (see add_poster_show_links.sql), so "which show was this
-- thanked from" isn't a stable property of the thanks itself — the show(s) a
-- thanks is relevant to are derived at read time from whichever show(s) the
-- underlying content_id actually belongs/links to (see GET
-- /api/thanks/show/:showId in server/routes/thanks.js).

CREATE TABLE IF NOT EXISTS public.thanks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type TEXT NOT NULL CHECK (content_type IN ('photo', 'poster', 'note', 'setlist_submission')),
    content_id UUID NOT NULL,
    thanked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT thanks_not_self CHECK (thanked_by <> recipient_id),
    UNIQUE (content_type, content_id, thanked_by)
);

CREATE INDEX IF NOT EXISTS idx_thanks_content_id ON public.thanks(content_id);
CREATE INDEX IF NOT EXISTS idx_thanks_recipient_id ON public.thanks(recipient_id);

ALTER TABLE public.thanks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read thanks" ON public.thanks FOR SELECT TO public USING (true);
-- Defensive only — real authZ (owner resolution, self-thanks rejection,
-- idempotent toggle) lives in server/routes/thanks.js; Express uses the
-- service-role key and bypasses RLS entirely.
CREATE POLICY "Authenticated users manage own thanks" ON public.thanks FOR ALL TO authenticated
    USING (thanked_by = auth.uid()) WITH CHECK (thanked_by = auth.uid());

COMMENT ON TABLE public.thanks IS 'Polymorphic, toggleable thanks on show content (photo/poster/note/setlist_submission). Public read; no show_id — a poster can be linked to multiple shows via poster_show_links, so "which show" isn''t a stable property of the thanks itself.';

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'thanks' CHECK (type IN ('thanks')),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('photo', 'poster', 'note', 'setlist_submission')),
    content_id UUID NOT NULL,
    show_id UUID REFERENCES public.shows(id) ON DELETE SET NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- No public policy — unlike thanks, notification feeds are private.
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated
    USING (user_id = auth.uid());
CREATE POLICY "Users mark own notifications read" ON public.notifications FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- No INSERT/DELETE policy for authenticated/public: notifications are only
-- ever created/deleted by the server (service-role key) in
-- server/routes/thanks.js, never written directly by a client.
-- Defensive only, same as above — Express bypasses RLS entirely.

COMMENT ON TABLE public.notifications IS 'In-app notifications (header bell). Currently only type=thanks; actor_id/show_id are nullable so history survives account/show deletion.';
