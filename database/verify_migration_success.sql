-- =====================================================
-- VERIFICATION: Confirm Migration Success
-- =====================================================
-- Run this to verify the migration completed successfully
-- =====================================================

-- 1. Check setlist_songs schema (should NOT have is_cover or original_artist)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'setlist_songs'
ORDER BY ordinal_position;

-- Expected columns:
-- id, show_id, song_id, set_number, song_order, notes, is_encore, jams_into, created_at

-- 2. Count statistics
SELECT 
    'Total Shows' as metric,
    COUNT(*) as count
FROM shows
UNION ALL
SELECT 
    'Total Songs' as metric,
    COUNT(*) as count
FROM songs
UNION ALL
SELECT 
    'Total Setlist Entries' as metric,
    COUNT(*) as count
FROM setlist_songs
UNION ALL
SELECT 
    'Setlist Entries with Valid song_id' as metric,
    COUNT(*) as count
FROM setlist_songs
WHERE song_id IS NOT NULL
UNION ALL
SELECT 
    'Setlist Entries WITHOUT song_id (should be 0)' as metric,
    COUNT(*) as count
FROM setlist_songs
WHERE song_id IS NULL;

-- 3. Sample data showing songs table as source of truth
SELECT 
    s.show_date,
    s.artist_name,
    v.name as venue,
    song.title,
    CASE 
        WHEN song.is_original = true THEN 'Original'
        WHEN song.is_original = false THEN 'Cover'
        ELSE 'Unknown'
    END as song_type,
    song.original_artist,
    song.written_by,
    ss.notes as performance_notes,
    ss.jams_into
FROM setlist_songs ss
JOIN shows s ON ss.show_id = s.id
LEFT JOIN venues v ON s.venue_id = v.id
JOIN songs song ON ss.song_id = song.id
ORDER BY s.show_date DESC, ss.set_number, ss.song_order
LIMIT 30;

-- 4. Check for songs with metadata
SELECT 
    COUNT(*) FILTER (WHERE is_original = true) as originals,
    COUNT(*) FILTER (WHERE is_original = false) as covers,
    COUNT(*) FILTER (WHERE is_original IS NULL) as unknown,
    COUNT(*) FILTER (WHERE original_artist IS NOT NULL) as has_original_artist,
    COUNT(*) FILTER (WHERE written_by IS NOT NULL) as has_written_by,
    COUNT(*) as total_songs
FROM songs;

-- 5. Shows with complete setlists
SELECT 
    s.show_date,
    s.artist_name,
    v.name as venue,
    COUNT(ss.id) as total_songs,
    COUNT(DISTINCT ss.song_id) as unique_songs,
    COUNT(*) FILTER (WHERE song.is_original = true) as originals,
    COUNT(*) FILTER (WHERE song.is_original = false) as covers
FROM shows s
LEFT JOIN venues v ON s.venue_id = v.id
LEFT JOIN setlist_songs ss ON s.id = ss.show_id
LEFT JOIN songs song ON ss.song_id = song.id
GROUP BY s.id, s.show_date, s.artist_name, v.name
HAVING COUNT(ss.id) > 0
ORDER BY s.show_date DESC
LIMIT 20;

