-- =====================================================
-- MIGRATION: Remove Song Metadata from setlist_songs
-- =====================================================
-- This migration removes is_cover and original_artist from setlist_songs
-- These fields should ONLY exist in the songs table (single source of truth)
--
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Step 1: Verify that all setlist_songs have valid song_id references
-- This query shows any setlist_songs without a song_id
SELECT 
    ss.id,
    ss.show_id,
    s.show_date,
    s.artist_name,
    v.name as venue_name
FROM setlist_songs ss
JOIN shows s ON ss.show_id = s.id
LEFT JOIN venues v ON s.venue_id = v.id
WHERE ss.song_id IS NULL
ORDER BY s.show_date DESC;

-- If the above query returns rows, you need to fix those first
-- Either delete them or match them to songs in the songs table

-- Step 2: Drop the redundant columns from setlist_songs
-- These fields belong ONLY in the songs table
ALTER TABLE public.setlist_songs 
DROP COLUMN IF EXISTS is_cover,
DROP COLUMN IF EXISTS original_artist;

-- Step 3: Verify the schema is correct
-- This should show only: id, show_id, song_id, set_number, song_order, notes, is_encore, jams_into, created_at
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'setlist_songs'
ORDER BY ordinal_position;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Count total setlist_songs
SELECT COUNT(*) as total_setlist_songs FROM setlist_songs;

-- Count setlist_songs with valid song references
SELECT COUNT(*) as songs_with_valid_reference 
FROM setlist_songs 
WHERE song_id IS NOT NULL;

-- Count setlist_songs without song references (should be 0)
SELECT COUNT(*) as songs_without_reference 
FROM setlist_songs 
WHERE song_id IS NULL;

-- Sample query to verify data integrity
SELECT 
    ss.id as setlist_song_id,
    s.show_date,
    s.artist_name,
    song.title,
    song.is_original,
    song.original_artist,
    song.written_by,
    ss.notes as performance_notes,
    ss.jams_into
FROM setlist_songs ss
JOIN shows s ON ss.show_id = s.id
JOIN songs song ON ss.song_id = song.id
ORDER BY s.show_date DESC, ss.set_number, ss.song_order
LIMIT 20;

COMMENT ON TABLE public.setlist_songs IS 'Junction table linking shows to songs. Song metadata (is_original, original_artist, etc.) is stored ONLY in the songs table.';

