# 🚨 URGENT: MASSIVE DATA LOSS - 142 Shows Affected

## Critical Situation

**142 shows have lost their setlist data** due to the `ON DELETE CASCADE` constraint issue.

This happened when a song was deleted through the admin panel. The CASCADE constraint deleted ALL setlist_songs entries for that song across ALL 142 shows.

## Immediate Priority Actions

### 1. STOP ALL SONG DELETIONS (IMMEDIATE)

**DO NOT delete any more songs until the database migration is applied!**

### 2. Apply Database Fix (URGENT - Within 24 hours)

Run this SQL in Supabase SQL Editor:

```sql
-- Fix the CASCADE constraint
ALTER TABLE public.setlist_songs DROP CONSTRAINT IF EXISTS setlist_songs_song_id_fkey;
ALTER TABLE public.setlist_songs ADD CONSTRAINT setlist_songs_song_id_fkey 
FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE RESTRICT;
```

This prevents any future data loss.

### 3. Data Recovery Strategy

We have **142 shows** to restore. This is too many to do manually.

#### Option A: Database Backup Restoration (FASTEST)
If you have a recent Supabase backup from before the deletion:
1. Restore the `setlist_songs` table from backup
2. Apply the constraint fix
3. Verify all shows have setlists

#### Option B: Automated Bulk Import from setlist.fm (RECOMMENDED)
1. Use the existing `import_from_setlistfm.py` script
2. Create a batch script to import all 142 shows
3. The script can query setlist.fm API for each show date

#### Option C: Manual Restoration (LAST RESORT)
Only if Options A and B fail. Would take days/weeks.

## Affected Shows Summary

- **Total affected:** 142 shows
- **Date range:** 2013-04-07 to 2025-09-17
- **Most recent:** September 17, 2025 (Red Rocks)
- **Oldest:** April 7, 2013 (Springfield, IL)

### Recent High-Profile Shows Lost:
1. 2025-09-17 - Red Rocks Amphitheatre, Morrison, CO
2. 2020-03-10 - North Charleston Coliseum (last show before COVID)
3. 2020-02-01 - Vicar Street, Dublin, Ireland
4. 2020-01-31 - Old Fruitmarket, Glasgow, Scotland

## Recovery Plan

### Phase 1: Prevent Further Loss (NOW)
- [x] Identify the issue
- [ ] Apply database constraint fix
- [ ] Test that song deletion is now blocked
- [ ] Document the issue

### Phase 2: Assess Backup Options (Within 24 hours)
- [ ] Check Supabase for point-in-time recovery
- [ ] Identify backup timestamp before deletion
- [ ] Test backup restoration in staging environment

### Phase 3: Bulk Data Recovery (Within 1 week)
- [ ] Create batch import script for setlist.fm
- [ ] Import all 142 shows from setlist.fm
- [ ] Verify data integrity
- [ ] Cross-check with any available backups

### Phase 4: Verification (After recovery)
- [ ] Verify all 142 shows have setlists
- [ ] Check song counts match setlist.fm
- [ ] Verify set numbers and song order
- [ ] Test user stats calculations

## Technical Details

### What Happened
```sql
-- The problematic constraint:
song_id UUID REFERENCES songs(id) ON DELETE CASCADE

-- When a song was deleted:
DELETE FROM songs WHERE id = '<some-song-id>';

-- This automatically triggered:
DELETE FROM setlist_songs WHERE song_id = '<some-song-id>';

-- Result: ALL performances of that song across ALL shows were deleted
```

### The Fix
```sql
-- New constraint:
song_id UUID REFERENCES songs(id) ON DELETE RESTRICT

-- Now when trying to delete a song in use:
DELETE FROM songs WHERE id = '<some-song-id>';
-- ERROR: Cannot delete song that is referenced in setlist_songs
```

## Files Created for Recovery

1. **`scripts/migrations/fix_song_delete_cascade.sql`** - Database fix
2. **`scripts/restore_sept17_2025_setlist.js`** - Restore Sept 17 show
3. **`scripts/find_empty_setlists.js`** - Find all affected shows
4. **`CRITICAL_FIX_SONG_DELETE.md`** - Detailed documentation
5. **`server/routes/songs.js`** (updated) - Better error handling

## Next Steps for You

1. **IMMEDIATELY:** Run the database migration to prevent more loss
2. **Check Supabase:** Look for point-in-time recovery options
3. **Decide on recovery strategy:** Backup restore vs. bulk import
4. **Let me know:** Which recovery option you want to pursue

## Bulk Import Script Needed

I can create a batch import script that:
- Reads the list of 142 affected shows
- Queries setlist.fm API for each show
- Automatically imports all setlists
- Logs success/failures
- Handles rate limiting

Would you like me to create this script?

## Questions to Answer

1. Do you have Supabase backups enabled?
2. When was the song deleted (approximate date/time)?
3. Do you want me to create the bulk import script?
4. Should we prioritize recent shows (2020-2025) first?

## Contact

This is a critical data loss situation. The sooner we act, the better the recovery outcome.

**Priority Level:** 🔴 CRITICAL  
**Time Sensitivity:** URGENT (within 24-48 hours)  
**Impact:** 142 shows (32% of total 443 shows) have no setlist data

