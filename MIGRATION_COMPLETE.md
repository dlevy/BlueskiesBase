# ✅ Migration Complete: Songs Table as Single Source of Truth

## What Was Done

### 1. Database Migration ✅
- Removed `is_cover` column from `setlist_songs` table
- Removed `original_artist` column from `setlist_songs` table
- Cleaned up any orphaned setlist_songs records without `song_id`

### 2. Code Refactoring ✅
- **Backend**: Updated all API endpoints to only use songs table for metadata
- **Frontend Admin**: Removed editing of is_cover/original_artist from SetlistEditor
- **Frontend Search**: Simplified stats calculation to use songs table only
- **Import Script**: Updated to populate songs table instead of setlist_songs

---

## Current Architecture

### `setlist_songs` Table (Junction Table Only)
```
- id (UUID)
- show_id (FK to shows)
- song_id (FK to songs) ← REQUIRED
- set_number (INTEGER)
- song_order (INTEGER)
- notes (TEXT) ← Performance-specific notes
- is_encore (BOOLEAN)
- jams_into (BOOLEAN) ← Performance-specific
- created_at (TIMESTAMP)
```

### `songs` Table (Single Source of Truth)
```
- id (UUID)
- title (TEXT)
- is_original (BOOLEAN) ← Master source
- original_artist (TEXT) ← Master source
- written_by (TEXT) ← Master source
- lyrics (TEXT)
- notes (TEXT)
- created_at (TIMESTAMP)
```

---

## Verification Steps

Run the verification script to confirm everything is working:

```sql
-- In Supabase SQL Editor:
-- Open database/verify_migration_success.sql and run it
```

This will show:
1. ✅ Current schema (should NOT have is_cover or original_artist)
2. ✅ Statistics (all setlist_songs should have valid song_id)
3. ✅ Sample data showing songs table metadata
4. ✅ Song metadata counts
5. ✅ Shows with complete setlists

---

## Testing the Application

### 1. Test Search Results
- Go to the search page
- Search for shows (e.g., "September 17, 2025" or "August 2, 2025")
- **Expected**: Each show card should display `[X Originals] [Y Covers]` badges
- **Expected**: Badges should appear for ALL shows (no missing badges)

### 2. Test Show Detail Page
- Click on any show to view details
- **Expected**: Header shows `[X Originals] [Y Covers]` badges
- **Expected**: Each song shows either `[Original]` or `[Cover]` badge
- **Expected**: Cover songs show original artist name

### 3. Test Admin Panel
- Go to Admin → Manage Shows → Edit a show
- Click "Edit Setlist"
- Expand a song's details (⚙️ icon)
- **Expected**: Song metadata (original artist, written by) is READ-ONLY
- **Expected**: Only performance-specific fields are editable (notes, jams into)
- **Expected**: Help text says "To change song metadata, edit the song in the Songs admin panel"

### 4. Test Songs Admin Panel
- Go to Admin → Manage Songs
- Edit any song
- **Expected**: Can edit is_original, original_artist, written_by
- **Expected**: Changes apply to ALL setlists using that song

---

## Data Flow

### Before (Inconsistent)
```
setlist.fm → setlist_songs (is_cover, original_artist)
                ↓
            Display (inconsistent data)
```

### After (Single Source of Truth)
```
setlist.fm → songs table (is_original, original_artist)
                ↓
            setlist_songs (song_id link only)
                ↓
            Display (consistent data from songs table)
```

---

## Future Imports

When you run the setlist.fm import script again:
- ✅ Cover information will be stored in `songs` table
- ✅ Existing songs will be updated if new cover info is found
- ✅ New songs will be created with correct metadata
- ✅ `setlist_songs` will only contain junction data

---

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Add the columns back
ALTER TABLE public.setlist_songs 
ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_artist TEXT;

-- Populate from songs table
UPDATE setlist_songs ss
SET 
    is_cover = NOT COALESCE(s.is_original, true),
    original_artist = s.original_artist
FROM songs s
WHERE ss.song_id = s.id;
```

**Note**: Rollback is NOT recommended as it reintroduces data redundancy.

---

## Benefits Achieved

✅ **Single Source of Truth**: Song metadata exists in ONE place only  
✅ **Consistency**: All setlists automatically reflect updated song metadata  
✅ **Simpler Code**: No more "smart merge" logic or workarounds  
✅ **Better Admin UX**: Edit song once, applies everywhere  
✅ **Cleaner Database**: No redundant data  
✅ **Easier Maintenance**: Clear separation of concerns  

---

## Next Steps

1. ✅ Run `database/verify_migration_success.sql` to confirm migration
2. ✅ Test the application (search, detail pages, admin)
3. ✅ If any issues found, report them immediately
4. ✅ Monitor Railway and Vercel deployments
5. ✅ Future imports will automatically use the new architecture

---

**Migration completed successfully!** 🎉

