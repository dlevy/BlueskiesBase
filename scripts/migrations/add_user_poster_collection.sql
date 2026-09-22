-- Migration: Add user_poster_collection table
-- Description: Tracks which show posters a user owns (as a physical collectible),
--              and whether they own the foil variant of that poster. Tied to the
--              existing user_posters row (the uploaded poster image for a show) —
--              not to the show directly — so it always points at a specific poster
--              design, and disappears cleanly if that poster is ever removed.

CREATE TABLE public.user_poster_collection (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    poster_id UUID NOT NULL REFERENCES public.user_posters(id) ON DELETE CASCADE,
    has_foil BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, poster_id)
);

CREATE INDEX idx_user_poster_collection_user_id ON public.user_poster_collection(user_id);

ALTER TABLE public.user_poster_collection ENABLE ROW LEVEL SECURITY;

-- Same pattern as the rest of the app's tables: the server uses a service-role
-- client (bypasses RLS) for all real reads/writes, but these policies keep the
-- table safe if anything ever queries it via an RLS-respecting client.
CREATE POLICY "Poster collection entries are viewable by everyone"
    ON public.user_poster_collection FOR SELECT USING (true);

CREATE POLICY "Users can manage their own poster collection"
    ON public.user_poster_collection FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_poster_collection IS 'Which show posters a user owns, and whether they have the foil variant';
