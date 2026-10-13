-- Migration: Mark a link as no-follow
-- Description: Lets admins/editors flag a link (e.g. a paid/sponsored or
-- otherwise untrusted outbound link) so the public /links page renders its
-- anchor with rel="nofollow", telling search engines not to follow or pass
-- ranking credit through it. Defaults to false — the vast majority of links
-- should keep passing normal SEO credit.

ALTER TABLE links
ADD COLUMN nofollow BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN links.nofollow IS 'When true, the public /links page renders this link''s anchor with rel="nofollow"';
