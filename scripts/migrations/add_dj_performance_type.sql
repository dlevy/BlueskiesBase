-- Adds 'dj' as a valid performance_type, for afterparty-style sets where a
-- song is DJ'd (played as a recording) rather than performed live by the
-- band — distinct from 'full'/'tease'/'partial', which all describe an
-- actual live performance.
ALTER TABLE public.setlist_songs DROP CONSTRAINT IF EXISTS setlist_songs_performance_type_check;
ALTER TABLE public.setlist_songs ADD CONSTRAINT setlist_songs_performance_type_check
    CHECK (performance_type IN ('full', 'tease', 'partial', 'dj'));
