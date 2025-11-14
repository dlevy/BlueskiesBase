-- Migration: Add performance_type column to setlist_songs
-- Date: 2025-11-14
-- Description: Add performance_type column to track whether a song was played in full, teased, or partially performed
--              This allows tracking of song teases and partial performances in setlists

-- Step 1: Add the performance_type column with default value
ALTER TABLE public.setlist_songs 
ADD COLUMN performance_type TEXT NOT NULL DEFAULT 'full';

-- Step 2: Add CHECK constraint to ensure only valid values
ALTER TABLE public.setlist_songs 
ADD CONSTRAINT setlist_songs_performance_type_check 
CHECK (performance_type IN ('full', 'tease', 'partial'));

-- Step 3: Create index for faster queries filtering by performance_type
CREATE INDEX IF NOT EXISTS idx_setlist_songs_performance_type 
ON public.setlist_songs(performance_type);

-- Step 4: Add comment explaining the column
COMMENT ON COLUMN public.setlist_songs.performance_type IS 
'Type of performance: full (complete song), tease (brief snippet without vocals), or partial (incomplete performance)';

-- Verification query (optional - run separately to verify)
-- SELECT performance_type, COUNT(*) 
-- FROM public.setlist_songs 
-- GROUP BY performance_type;

