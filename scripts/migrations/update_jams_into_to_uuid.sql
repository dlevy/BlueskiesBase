-- Migration: Update jams_into from boolean to UUID
-- Date: 2025-11-12
-- Description: Change jams_into column from boolean to UUID to properly reference the next song

-- Step 1: Drop the existing boolean column
ALTER TABLE setlist_songs DROP COLUMN IF EXISTS jams_into;

-- Step 2: Add new jams_into column as UUID
ALTER TABLE setlist_songs ADD COLUMN jams_into UUID REFERENCES songs(id) ON DELETE SET NULL;

-- Step 3: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_setlist_songs_jams_into ON setlist_songs(jams_into);

-- Add comment
COMMENT ON COLUMN setlist_songs.jams_into IS 'UUID of the song that this song jams into (for medleys/transitions)';

