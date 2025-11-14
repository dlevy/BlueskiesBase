# September 17, 2025 Setlist Restoration

## Problem

When a song was deleted from the admin panel that had "no associated concerts", the database's `ON DELETE CASCADE` constraint on `setlist_songs.song_id` caused **all setlist entries** for that song to be automatically deleted across **all shows**.

This resulted in the September 17, 2025 Red Rocks show (and potentially others) losing their setlist data.

## Root Cause

The database schema had:
```sql
ALTER TABLE public.setlist_songs 
ADD CONSTRAINT setlist_songs_song_id_fkey 
FOREIGN KEY (song_id) 
REFERENCES public.songs(id) 
ON DELETE CASCADE;  -- ❌ This is the problem!
```

When a song is deleted, `ON DELETE CASCADE` automatically deletes all related `setlist_songs` entries, even if they're from historical shows. This is a **critical data integrity issue**.

## Solution

### Step 1: Fix the Database Constraint

Run the migration to change `ON DELETE CASCADE` to `ON DELETE RESTRICT`:

```bash
# Connect to your Supabase database and run:
psql -h <your-supabase-host> -U postgres -d postgres -f scripts/migrations/fix_song_delete_cascade.sql
```

Or run it directly in the Supabase SQL Editor:
```sql
-- Drop the existing foreign key constraint
ALTER TABLE public.setlist_songs 
DROP CONSTRAINT IF EXISTS setlist_songs_song_id_fkey;

-- Re-add with ON DELETE RESTRICT
ALTER TABLE public.setlist_songs 
ADD CONSTRAINT setlist_songs_song_id_fkey 
FOREIGN KEY (song_id) 
REFERENCES public.songs(id) 
ON DELETE RESTRICT;
```

This will **prevent** songs from being deleted if they're used in any setlists, protecting historical data.

### Step 2: Restore the September 17, 2025 Setlist

Run the restore script:

```bash
cd scripts
node restore_sept17_2025_setlist.js
```

This will:
1. Find the September 17, 2025 show
2. Check if a setlist already exists (to avoid duplicates)
3. Create any missing songs
4. Restore all 41 songs to the setlist in the correct order

### Step 3: Verify the Restoration

Check the show page:
- Navigate to the September 17, 2025 show in the app
- Verify all 41 songs are present
- Verify the order is correct

Or query the database:
```sql
SELECT 
    ss.set_number,
    ss.song_order,
    s.title,
    s.original_artist,
    ss.notes
FROM setlist_songs ss
JOIN songs s ON ss.song_id = s.id
JOIN shows sh ON ss.show_id = sh.id
WHERE sh.show_date = '2025-09-17'
ORDER BY ss.set_number, ss.song_order;
```

## Prevention

After applying the migration:

1. ✅ Songs **cannot** be deleted if they're used in any setlists
2. ✅ The delete endpoint will return a clear error message with usage count
3. ✅ Admins must remove songs from all setlists before deleting them
4. ✅ Historical setlist data is protected

## Checking for Other Affected Shows

To find other shows that may have lost setlist data, run:

```sql
-- Find shows with no setlist songs
SELECT 
    s.id,
    s.show_date,
    s.artist_name,
    v.name as venue_name,
    v.city
FROM shows s
LEFT JOIN setlist_songs ss ON s.id = ss.show_id
LEFT JOIN venues v ON s.venue_id = v.id
WHERE ss.id IS NULL
ORDER BY s.show_date DESC;
```

If you find other affected shows, you can:
1. Check setlist.fm for the setlist data
2. Create a similar restore script
3. Or manually re-enter the setlist through the admin panel

## Updated Delete Behavior

The song delete endpoint now:
- Checks for setlist usage before attempting deletion
- Returns the count of setlists using the song
- Provides a clear error message
- Handles the foreign key constraint error gracefully

Example error response:
```json
{
  "error": "Cannot delete song that is used in setlists",
  "message": "This song appears in 15 setlist(s) and cannot be deleted. Remove it from all setlists first.",
  "usageCount": 15
}
```

## Data Source

Setlist data sourced from:
https://www.setlist.fm/setlist/sturgill-simpson/2025/red-rocks-amphitheatre-morrison-co-1b405168.html

## Notes

- The September 17, 2025 show had 41 songs total
- 17 were covers
- The setlist includes multiple reprises and interpolations
- All song metadata (notes, original artists) has been preserved

