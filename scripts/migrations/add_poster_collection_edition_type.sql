-- Lets a member mark whether their owned copy of a poster is a standard
-- original print or an AP (Artist's Proof).
ALTER TABLE public.user_poster_collection ADD COLUMN IF NOT EXISTS edition_type TEXT NOT NULL DEFAULT 'original';
ALTER TABLE public.user_poster_collection ADD CONSTRAINT user_poster_collection_edition_type_check
    CHECK (edition_type IN ('original', 'ap'));
