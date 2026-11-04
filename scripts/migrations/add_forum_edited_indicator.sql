-- Migration: Add forum edited indicator
-- "(edited)" next to the date in AuthorLine (ForumThreadPage) for both
-- threads and replies. Deliberately NOT derived from updated_at !==
-- created_at: PATCH /threads/:id/moderate (pin/lock) bumps
-- forum_threads.updated_at on every call, including a genuine pin/unpin
-- that changed nothing content-wise — using updated_at would show
-- "(edited)" on a merely pinned/locked thread. A dedicated, nullable
-- edited_at column set ONLY by the real content-edit routes is an
-- unambiguous signal with zero risk to the moderate route's existing
-- behavior, rather than reworking that route's semantics.

ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.forum_replies ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.forum_threads.edited_at IS 'Set only by PUT /api/forum/threads/:id (a real content edit) — never by PATCH .../moderate. NULL means never edited; drives the "(edited)" label, independent of updated_at.';
COMMENT ON COLUMN public.forum_replies.edited_at IS 'Set only by PUT /api/forum/replies/:id (a real content edit). NULL means never edited; drives the "(edited)" label, independent of updated_at.';
