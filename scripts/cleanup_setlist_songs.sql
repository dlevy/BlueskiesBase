-- =====================================================
-- CLEANUP: Fix setlist_songs with NULL song_id
-- =====================================================
-- This script identifies and optionally deletes setlist_songs
-- that don't have a valid song_id reference
--
-- Run this BEFORE the migration to remove is_cover/original_artist
-- =====================================================

-- =====================================================
-- STEP 1: IDENTIFY ORPHANED SETLIST_SONGS
-- =====================================================

-- Find all setlist_songs without a song_id
SELECT 
    ss.id as setlist_song_id,
    ss.show_id,
    s.show_date,
    s.artist_name,
    v.name as venue_name,
    v.city,
    ss.set_number,
    ss.song_order,
    ss.is_encore,
    ss.notes
FROM setlist_songs ss
JOIN shows s ON ss.show_id = s.id
LEFT JOIN venues v ON s.venue_id = v.id
WHERE ss.song_id IS NULL
ORDER BY s.show_date DESC, ss.set_number, ss.song_order;

-- Count by show
SELECT 
    s.show_date,
    s.artist_name,
    v.name as venue_name,
    COUNT(*) as orphaned_songs
FROM setlist_songs ss
JOIN shows s ON ss.show_id = s.id
LEFT JOIN venues v ON s.venue_id = v.id
WHERE ss.song_id IS NULL
GROUP BY s.show_date, s.artist_name, v.name
ORDER BY s.show_date DESC;

-- =====================================================
-- STEP 2: DELETE ORPHANED SETLIST_SONGS
-- =====================================================
-- WARNING: This will permanently delete setlist_songs without song_id
-- Uncomment the line below to execute the deletion

-- DELETE FROM setlist_songs WHERE song_id IS NULL;

-- After deletion, verify:
-- SELECT COUNT(*) FROM setlist_songs WHERE song_id IS NULL;
-- Should return 0

-- =====================================================
-- STEP 3: VERIFY DATA INTEGRITY
-- =====================================================

-- Check for any songs table records not referenced by setlist_songs
SELECT 
    song.id,
    song.title,
    song.is_original,
    song.original_artist,
    COUNT(ss.id) as times_performed
FROM songs song
LEFT JOIN setlist_songs ss ON song.id = ss.song_id
GROUP BY song.id, song.title, song.is_original, song.original_artist
HAVING COUNT(ss.id) = 0
ORDER BY song.title;

-- Check for duplicate song titles (might need consolidation)
SELECT 
    title,
    COUNT(*) as count,
    STRING_AGG(id::TEXT, ', ') as song_ids
FROM songs
GROUP BY title
HAVING COUNT(*) > 1
ORDER BY count DESC, title;

-- =====================================================
-- STEP 4: SUMMARY STATISTICS
-- =====================================================

-- Total counts
SELECT 
    (SELECT COUNT(*) FROM shows) as total_shows,
    (SELECT COUNT(*) FROM songs) as total_songs,
    (SELECT COUNT(*) FROM setlist_songs) as total_setlist_entries,
    (SELECT COUNT(*) FROM setlist_songs WHERE song_id IS NULL) as orphaned_entries,
    (SELECT COUNT(DISTINCT song_id) FROM setlist_songs WHERE song_id IS NOT NULL) as unique_songs_performed;

-- Shows with complete setlists (all songs have song_id)
SELECT 
    s.show_date,
    s.artist_name,
    v.name as venue_name,
    COUNT(ss.id) as total_songs,
    COUNT(ss.song_id) as songs_with_reference,
    CASE 
        WHEN COUNT(ss.id) = COUNT(ss.song_id) THEN 'COMPLETE'
        ELSE 'INCOMPLETE'
    END as status
FROM shows s
LEFT JOIN venues v ON s.venue_id = v.id
LEFT JOIN setlist_songs ss ON s.id = ss.show_id
GROUP BY s.id, s.show_date, s.artist_name, v.name
HAVING COUNT(ss.id) > 0
ORDER BY s.show_date DESC;

