-- Migration: Associate a link with a member account
-- Description: Lets admins/editors link an external link (e.g. a Poster
-- Artists entry) to the SkySets.org member account that owns/runs it, so the
-- public /links page can show "by @username" alongside the external URL.
-- Nullable — most links have no associated member.

ALTER TABLE links
ADD COLUMN member_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_links_member_id ON links(member_id);

COMMENT ON COLUMN links.member_id IS 'Optional FK to profiles — the SkySets.org member account associated with this link, shown as "by @username" on the public /links page';
