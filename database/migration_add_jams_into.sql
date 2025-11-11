-- =====================================================
-- MIGRATION: Add "Jams Into" Feature
-- =====================================================
-- This migration adds a field to track when one song
-- jams/segues into the next song in a setlist
--
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Add jams_into column to setlist_songs table
ALTER TABLE public.setlist_songs 
ADD COLUMN IF NOT EXISTS jams_into BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.setlist_songs.jams_into IS 'Whether this song jams/segues into the next song (indicated by > symbol)';

-- =====================================================
-- ALSO FIX MISSING COLUMNS (if not already added)
-- =====================================================
-- These are critical columns that should exist but might be missing

ALTER TABLE public.setlist_songs 
ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_artist TEXT;

COMMENT ON COLUMN public.setlist_songs.is_cover IS 'Whether this song is a cover (not original to the artist)';
COMMENT ON COLUMN public.setlist_songs.original_artist IS 'Original artist name if this is a cover';

