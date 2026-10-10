-- Adds 'soundcheck' as a valid performance_type, for songs played at
-- soundcheck rather than the actual show — distinct from 'dj' (a recording
-- played over the speakers) and from 'full'/'tease'/'partial' (all actual
-- live performances during the show itself). Excluded from tour rarity,
-- debut, and "songs seen" stats the same way 'dj' already is.
ALTER TABLE public.setlist_songs DROP CONSTRAINT IF EXISTS setlist_songs_performance_type_check;
ALTER TABLE public.setlist_songs ADD CONSTRAINT setlist_songs_performance_type_check
    CHECK (performance_type IN ('full', 'tease', 'partial', 'dj', 'soundcheck'));
