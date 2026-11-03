-- Lets a song's "Live Debut" tag be suppressed even though it has a
-- computed earliest-performance date — for songs from a sparsely-documented
-- era (e.g. a newly-added old setlist) where "first played here" is likely
-- an artifact of incomplete records rather than a real debut. Does not
-- affect the song's actual first/last-played dates or performance history —
-- only whether the celebratory "Live Debut" badge is shown.
ALTER TABLE songs ADD COLUMN IF NOT EXISTS live_debut_suppressed boolean NOT NULL DEFAULT false;
