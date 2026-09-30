-- Migration: Add poster_show_links join table
-- Description: Lets one uploaded poster image (user_posters row) be linked to
-- many shows — e.g. a single tour-leg poster used for every date on a run of
-- shows — instead of the previous strict one-poster-per-show model. Every
-- existing poster is backfilled with a link to its own show, so nothing about
-- today's single-show posters changes.
--
-- The unique constraint on (show_id, is_foil) preserves the existing rule
-- that a show can have at most one regular and one foil poster — now
-- enforced at the link level rather than directly on user_posters.show_id.

CREATE TABLE IF NOT EXISTS public.poster_show_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poster_id UUID NOT NULL REFERENCES public.user_posters(id) ON DELETE CASCADE,
    show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
    is_foil BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (show_id, is_foil)
);

CREATE INDEX IF NOT EXISTS idx_poster_show_links_poster_id ON public.poster_show_links(poster_id);
CREATE INDEX IF NOT EXISTS idx_poster_show_links_show_id ON public.poster_show_links(show_id);

ALTER TABLE public.poster_show_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read poster_show_links" ON public.poster_show_links FOR SELECT TO public USING (true);
-- Defensive only — real authZ is server-side requireEditorOrAdmin (Express
-- uses the service-role key and bypasses RLS entirely).
CREATE POLICY "Editors/admins manage poster_show_links" ON public.poster_show_links FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','editor')));

-- Backfill: every existing poster becomes linked to the one show it already belongs to.
INSERT INTO public.poster_show_links (poster_id, show_id, is_foil)
SELECT id, show_id, is_foil FROM public.user_posters
ON CONFLICT (show_id, is_foil) DO NOTHING;

COMMENT ON TABLE public.poster_show_links IS 'Many-to-many: which shows a given uploaded poster (user_posters) applies to. A show can have at most one regular and one foil poster (enforced by the unique (show_id, is_foil) constraint), but one poster can be linked to many shows (a tour-leg poster).';
