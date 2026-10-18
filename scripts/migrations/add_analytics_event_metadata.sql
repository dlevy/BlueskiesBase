-- Lets a 'feature' event carry a short human-readable description of which
-- record it acted on (e.g. "Mutiny for the Masses — Nashville, TN, Oct 15"),
-- not just the event name — needed for the admin/curator content-mutation
-- audit events (show/song/album/venue/band-member/gear/link create-update-
-- delete) to actually say WHAT was touched, not just that something was.
-- Nullable — pageviews and the existing public feature events never set it.

ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS metadata TEXT;
