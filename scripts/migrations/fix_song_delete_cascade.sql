-- Migration: Fix song delete cascade to prevent accidental data loss
-- Date: 2025-11-14
-- Description: Change ON DELETE CASCADE to ON DELETE RESTRICT for setlist_songs.song_id
--              This prevents accidental deletion of setlist data when a song is deleted

-- Drop the existing foreign key constraint
ALTER TABLE public.setlist_songs 
DROP CONSTRAINT IF EXISTS setlist_songs_song_id_fkey;

-- Re-add the foreign key constraint with ON DELETE RESTRICT
ALTER TABLE public.setlist_songs 
ADD CONSTRAINT setlist_songs_song_id_fkey 
FOREIGN KEY (song_id) 
REFERENCES public.songs(id) 
ON DELETE RESTRICT;

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT setlist_songs_song_id_fkey ON public.setlist_songs IS 
'Prevents deletion of songs that are used in setlists. Use ON DELETE RESTRICT to protect historical setlist data.';

