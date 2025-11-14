# 🚨 CRITICAL: Apply Database Migration NOW

## What Happened

When you deleted a song through the admin panel, the database's `ON DELETE CASCADE` constraint caused **ALL setlist entries for that song to be deleted across ALL shows** - not just one show.

**Result:** 140 shows lost their setlist data (those shows never had data on setlist.fm either, so no recovery possible).

## The Fix

Change the database constraint from `CASCADE` to `RESTRICT` so songs **CANNOT** be deleted if they're used in any setlists.

## How to Apply (2 minutes)

### Step 1: Open Supabase SQL Editor

The SQL Editor should already be open in your browser. If not:
1. Go to: https://supabase.com/dashboard/project/sxkonriiudchfhkrrait/sql/new

### Step 2: Copy and Paste This SQL

```sql
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
```

### Step 3: Click "Run"

Click the "Run" button in the SQL Editor.

### Step 4: Verify

You should see a success message. The constraint is now fixed!

## What This Does

✅ **BEFORE (DANGEROUS):**
- Delete a song → ALL setlist entries for that song are deleted across ALL shows
- Massive data loss possible

✅ **AFTER (SAFE):**
- Try to delete a song that's used in setlists → ERROR: "Cannot delete song that is used in setlists"
- No data loss possible
- You must remove the song from all setlists first before deleting it

## Backend Protection

The backend already has additional protection in place:
- Checks if song is used in setlists before deletion
- Returns error with usage count if song is in use
- Only allows deletion of songs that are NOT in any setlists

## Test It

After applying the migration, try deleting a song that's used in a setlist through the admin panel. You should see an error message preventing the deletion.

---

**⚠️ DO THIS NOW to prevent future data loss!**

