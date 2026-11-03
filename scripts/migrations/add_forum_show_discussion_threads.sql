-- Lets a forum thread be tied to a specific show — created lazily (never
-- automatically) via a "Start Discussion" button on the show page, which
-- the show page also uses to check whether one already exists and link to
-- it instead. At most one discussion thread per show, enforced by the
-- partial unique index below (NULL show_id, i.e. every ordinary thread, is
-- unconstrained). ON DELETE SET NULL rather than CASCADE — deleting a show
-- shouldn't destroy a real discussion that grew up around it.
ALTER TABLE public.forum_threads ADD COLUMN IF NOT EXISTS show_id UUID REFERENCES public.shows(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_threads_show_id_unique ON public.forum_threads(show_id) WHERE show_id IS NOT NULL;

-- Which category auto-created show-discussion threads file under — an
-- admin-settable flag rather than hardcoding a category name/id, so
-- renaming or repointing it later needs no code change. At most one
-- category should ever have this set; enforced the same partial-unique way.
ALTER TABLE public.forum_categories ADD COLUMN IF NOT EXISTS is_show_discussion_category BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_categories_show_discussion_unique ON public.forum_categories((is_show_discussion_category)) WHERE is_show_discussion_category = true;

-- Seed the category the feature was actually requested for, so it works
-- immediately without a manual admin setup step. ON CONFLICT DO NOTHING
-- matches the existing link_categories seed pattern — if a category with
-- this exact name already exists (e.g. created by hand first), this is a
-- no-op and the UPDATE below just flags whichever one already has that name.
INSERT INTO public.forum_categories (name, description, sort_order)
VALUES ('Setlists & Show Reports', 'Recaps and discussion for individual shows', 0)
ON CONFLICT (name) DO NOTHING;

UPDATE public.forum_categories SET is_show_discussion_category = true WHERE name = 'Setlists & Show Reports';
