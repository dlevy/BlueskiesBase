-- =====================================================
-- DEBUG: Shows Missing Originals/Covers Tags
-- =====================================================
-- Investigate specific shows that aren't displaying tags
-- =====================================================

-- 1. Check the specific shows exist and have setlists
SELECT 
    s.id,
    s.show_date,
    s.artist_name,
    v.name as venue,
    v.city,
    COUNT(ss.id) as total_setlist_entries
FROM shows s
LEFT JOIN venues v ON s.venue_id = v.id
LEFT JOIN setlist_songs ss ON s.id = ss.show_id
WHERE s.show_date IN ('2025-09-17', '2025-08-02', '2025-05-21', '2025-05-20')
GROUP BY s.id, s.show_date, s.artist_name, v.name, v.city
ORDER BY s.show_date DESC;

-- 2. Check setlist_songs for these shows - do they have song_id?
SELECT 
    s.show_date,
    ss.id as setlist_song_id,
    ss.song_id,
    ss.set_number,
    ss.song_order,
    CASE 
        WHEN ss.song_id IS NULL THEN '❌ NULL'
        ELSE '✅ Has song_id'
    END as has_song_id
FROM shows s
JOIN setlist_songs ss ON s.id = ss.show_id
WHERE s.show_date IN ('2025-09-17', '2025-08-02', '2025-05-21', '2025-05-20')
ORDER BY s.show_date DESC, ss.set_number, ss.song_order;

-- 3. Check if songs have is_original set
SELECT 
    s.show_date,
    song.id as song_id,
    song.title,
    song.is_original,
    song.original_artist,
    CASE 
        WHEN song.is_original IS NULL THEN '⚠️ NULL (Unknown)'
        WHEN song.is_original = true THEN '✅ Original'
        WHEN song.is_original = false THEN '✅ Cover'
    END as status
FROM shows s
JOIN setlist_songs ss ON s.id = ss.show_id
JOIN songs song ON ss.song_id = song.id
WHERE s.show_date IN ('2025-09-17', '2025-08-02', '2025-05-21', '2025-05-20')
ORDER BY s.show_date DESC, ss.set_number, ss.song_order;

-- 4. Count originals vs covers for these shows
SELECT 
    s.show_date,
    s.artist_name,
    v.name as venue,
    COUNT(*) as total_songs,
    COUNT(DISTINCT ss.song_id) as unique_songs,
    COUNT(*) FILTER (WHERE song.is_original = true) as originals,
    COUNT(*) FILTER (WHERE song.is_original = false) as covers,
    COUNT(*) FILTER (WHERE song.is_original IS NULL) as unknown,
    COUNT(*) FILTER (WHERE ss.song_id IS NULL) as missing_song_id
FROM shows s
LEFT JOIN venues v ON s.venue_id = v.id
LEFT JOIN setlist_songs ss ON s.id = ss.show_id
LEFT JOIN songs song ON ss.song_id = song.id
WHERE s.show_date IN ('2025-09-17', '2025-08-02', '2025-05-21', '2025-05-20')
GROUP BY s.id, s.show_date, s.artist_name, v.name
ORDER BY s.show_date DESC;

-- 5. Find ALL shows with songs that have NULL is_original
SELECT 
    s.show_date,
    s.artist_name,
    v.name as venue,
    COUNT(*) FILTER (WHERE song.is_original IS NULL) as songs_with_null_is_original,
    COUNT(*) as total_songs
FROM shows s
LEFT JOIN venues v ON s.venue_id = v.id
LEFT JOIN setlist_songs ss ON s.id = ss.show_id
LEFT JOIN songs song ON ss.song_id = song.id
GROUP BY s.id, s.show_date, s.artist_name, v.name
HAVING COUNT(*) FILTER (WHERE song.is_original IS NULL) > 0
ORDER BY s.show_date DESC
LIMIT 50;

-- 6. List songs with NULL is_original (need to be fixed)
SELECT 
    song.id,
    song.title,
    song.is_original,
    song.original_artist,
    COUNT(ss.id) as times_performed
FROM songs song
LEFT JOIN setlist_songs ss ON song.id = ss.song_id
WHERE song.is_original IS NULL
GROUP BY song.id, song.title, song.is_original, song.original_artist
ORDER BY times_performed DESC, song.title;

