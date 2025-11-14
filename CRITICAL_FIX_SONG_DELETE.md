# CRITICAL FIX: Song Deletion Data Loss Issue

## 🚨 CRITICAL ISSUE IDENTIFIED

**Date:** November 14, 2025  
**Severity:** CRITICAL - Data Loss  
**Status:** ⚠️ REQUIRES IMMEDIATE ACTION

## Problem Summary

When deleting a song through the admin panel, the database's `ON DELETE CASCADE` constraint on the `setlist_songs` table causes **ALL setlist entries for that song to be deleted across ALL shows**, not just the current show.

### What Happened

1. Admin deleted a song that appeared to have "no associated concerts"
2. The database CASCADE deleted all `setlist_songs` entries for that song
3. At least one show (September 17, 2025 Red Rocks) lost its entire setlist
4. Other shows may also be affected

### Root Cause

```sql
-- CURRENT (DANGEROUS) CONSTRAINT:
ALTER TABLE setlist_songs 
ADD CONSTRAINT setlist_songs_song_id_fkey 
FOREIGN KEY (song_id) REFERENCES songs(id) 
ON DELETE CASCADE;  -- ❌ Deletes all setlist entries!
```

## Immediate Actions Required

### 1. Run the Database Migration (URGENT)

This prevents future data loss:

```bash
# Option A: Using psql
psql -h <supabase-host> -U postgres -d postgres -f scripts/migrations/fix_song_delete_cascade.sql

# Option B: In Supabase SQL Editor, run:
ALTER TABLE public.setlist_songs DROP CONSTRAINT IF EXISTS setlist_songs_song_id_fkey;
ALTER TABLE public.setlist_songs ADD CONSTRAINT setlist_songs_song_id_fkey 
FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE RESTRICT;
```

### 2. Restore Lost Data

Restore the September 17, 2025 setlist:

```bash
cd scripts
node restore_sept17_2025_setlist.js
```

### 3. Check for Other Affected Shows

Find other shows that may have lost setlists:

```bash
cd scripts
node find_empty_setlists.js
```

## Files Created

1. **`scripts/migrations/fix_song_delete_cascade.sql`**
   - Database migration to fix the constraint
   - Changes `ON DELETE CASCADE` to `ON DELETE RESTRICT`

2. **`scripts/restore_sept17_2025_setlist.js`**
   - Restores the September 17, 2025 Red Rocks setlist
   - 41 songs from setlist.fm

3. **`scripts/find_empty_setlists.js`**
   - Identifies shows with no setlist songs
   - Helps find other affected shows

4. **`scripts/RESTORE_SEPT17_README.md`**
   - Detailed documentation of the issue and fix

5. **`server/routes/songs.js`** (updated)
   - Improved error handling
   - Better usage count reporting
   - Handles foreign key constraint errors

## After the Fix

Once the migration is applied:

✅ **Songs CANNOT be deleted if used in any setlists**  
✅ **Clear error messages show usage count**  
✅ **Historical setlist data is protected**  
✅ **Admins must remove songs from setlists before deletion**

### New Delete Behavior

```javascript
// Attempting to delete a song used in setlists:
{
  "error": "Cannot delete song that is used in setlists",
  "message": "This song appears in 15 setlist(s) and cannot be deleted. Remove it from all setlists first.",
  "usageCount": 15
}
```

## Verification Steps

After running the migration and restore:

1. **Check the constraint:**
   ```sql
   SELECT 
       conname,
       confdeltype
   FROM pg_constraint
   WHERE conname = 'setlist_songs_song_id_fkey';
   -- confdeltype should be 'r' (RESTRICT), not 'c' (CASCADE)
   ```

2. **Verify September 17, 2025 setlist:**
   ```sql
   SELECT COUNT(*) 
   FROM setlist_songs ss
   JOIN shows s ON ss.show_id = s.id
   WHERE s.show_date = '2025-09-17';
   -- Should return 41
   ```

3. **Test deletion protection:**
   - Try to delete a song that's in a setlist
   - Should receive error message with usage count
   - Setlist should remain intact

## Prevention Checklist

- [ ] Run `fix_song_delete_cascade.sql` migration
- [ ] Run `restore_sept17_2025_setlist.js` script
- [ ] Run `find_empty_setlists.js` to check for other affected shows
- [ ] Restore any other affected shows
- [ ] Test song deletion with a song in a setlist (should fail)
- [ ] Test song deletion with a song NOT in any setlist (should succeed)
- [ ] Update admin documentation about song deletion workflow
- [ ] Consider adding a warning in the admin UI about song deletion

## Long-term Improvements

1. **Admin UI Enhancement:**
   - Show usage count before deletion
   - List which shows use the song
   - Provide "Remove from all setlists" option

2. **Audit Logging:**
   - Log all song deletions
   - Track what data was affected

3. **Backup Strategy:**
   - Regular database backups
   - Point-in-time recovery capability

4. **Testing:**
   - Add integration tests for deletion constraints
   - Test cascade behavior for all foreign keys

## Contact

If you encounter issues with this fix, check:
- Supabase logs for constraint errors
- Application logs for deletion attempts
- Database constraint configuration

## References

- September 17, 2025 setlist source: https://www.setlist.fm/setlist/sturgill-simpson/2025/red-rocks-amphitheatre-morrison-co-1b405168.html
- PostgreSQL Foreign Key Documentation: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK

