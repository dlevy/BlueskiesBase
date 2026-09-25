-- Migration: Add user_poster_wants table
-- Description: A "wanted" list — shows a user is looking to acquire a poster
--              for, as opposed to user_poster_collection (posters they already
--              own). Tied directly to the show, not to a user_posters row —
--              unlike a collected poster, a wanted one may not exist yet (no
--              one has uploaded it) or the user simply doesn't have it, so
--              there's nothing concrete to reference besides the show itself.
--              `variant` records which edition they're after, when they care.

CREATE TABLE public.user_poster_wants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
    variant TEXT NOT NULL DEFAULT 'any' CHECK (variant IN ('any', 'regular', 'foil')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, show_id)
);

CREATE INDEX idx_user_poster_wants_user_id ON public.user_poster_wants(user_id);

ALTER TABLE public.user_poster_wants ENABLE ROW LEVEL SECURITY;

-- Same pattern as the rest of the app's tables: the server uses a service-role
-- client (bypasses RLS) for all real reads/writes, but these policies keep the
-- table safe if anything ever queries it via an RLS-respecting client.
CREATE POLICY "Poster wants are viewable by everyone"
    ON public.user_poster_wants FOR SELECT USING (true);

CREATE POLICY "Users can manage their own poster wants"
    ON public.user_poster_wants FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_poster_wants IS 'Shows a user is looking to acquire a poster for (a wishlist), independent of any poster they already own';
