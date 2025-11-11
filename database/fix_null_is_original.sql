-- =====================================================
-- FIX: Set is_original for songs with NULL values
-- =====================================================
-- This script fixes songs that have is_original = NULL
-- Default assumption: If no original_artist is set, it's an original
-- =====================================================

-- 1. First, let's see what we're dealing with
SELECT 
    COUNT(*) as total_songs,
    COUNT(*) FILTER (WHERE is_original = true) as originals,
    COUNT(*) FILTER (WHERE is_original = false) as covers,
    COUNT(*) FILTER (WHERE is_original IS NULL) as unknown
FROM songs;

-- 2. List songs with NULL is_original
SELECT 
    id,
    title,
    is_original,
    original_artist,
    CASE 
        WHEN original_artist IS NOT NULL THEN 'Should be COVER'
        ELSE 'Should be ORIGINAL'
    END as suggested_fix
FROM songs
WHERE is_original IS NULL
ORDER BY title;

-- 3. Count how many shows are affected
SELECT 
    COUNT(DISTINCT s.id) as shows_affected
FROM shows s
JOIN setlist_songs ss ON s.id = ss.show_id
JOIN songs song ON ss.song_id = song.id
WHERE song.is_original IS NULL;

-- 4. FIX: Update songs with NULL is_original
-- Logic:
--   - If original_artist is set, it's a COVER (is_original = false)
--   - If original_artist is NULL, it's an ORIGINAL (is_original = true)

UPDATE songs
SET is_original = CASE 
    WHEN original_artist IS NOT NULL THEN false
    ELSE true
END
WHERE is_original IS NULL;

-- 5. Verify the fix
SELECT 
    COUNT(*) as total_songs,
    COUNT(*) FILTER (WHERE is_original = true) as originals,
    COUNT(*) FILTER (WHERE is_original = false) as covers,
    COUNT(*) FILTER (WHERE is_original IS NULL) as unknown_should_be_zero
FROM songs;

-- 6. Check the previously affected shows
SELECT 
    s.show_date,
    s.artist_name,
    v.name as venue,
    COUNT(*) as total_songs,
    COUNT(*) FILTER (WHERE song.is_original = true) as originals,
    COUNT(*) FILTER (WHERE song.is_original = false) as covers,
    COUNT(*) FILTER (WHERE song.is_original IS NULL) as unknown_should_be_zero
FROM shows s
LEFT JOIN venues v ON s.venue_id = v.id
LEFT JOIN setlist_songs ss ON s.id = ss.show_id
LEFT JOIN songs song ON ss.song_id = song.id
WHERE s.show_date IN ('2025-09-17', '2025-08-02', '2025-05-21', '2025-05-20')
GROUP BY s.id, s.show_date, s.artist_name, v.name
ORDER BY s.show_date DESC;

-- 7. Sample of fixed songs
SELECT 
    title,
    is_original,
    original_artist,
    CASE 
        WHEN is_original = true THEN '✅ Original'
        WHEN is_original = false THEN '✅ Cover'
        ELSE '❌ Still NULL'
    END as status
FROM songs
ORDER BY is_original, title
LIMIT 50;

