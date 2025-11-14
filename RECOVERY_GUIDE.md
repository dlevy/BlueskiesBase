# 🚨 Data Recovery Guide - 142 Shows Missing Setlists

## Quick Start Recovery (Recommended)

### Step 1: Apply Database Fix (CRITICAL - Do This First!)

This prevents any future data loss from song deletions.

**Run in Supabase SQL Editor:**

```sql
-- Fix the CASCADE constraint
ALTER TABLE public.setlist_songs DROP CONSTRAINT IF EXISTS setlist_songs_song_id_fkey;
ALTER TABLE public.setlist_songs ADD CONSTRAINT setlist_songs_song_id_fkey 
FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE RESTRICT;
```

**Verify the fix:**

```sql
SELECT conname, confdeltype
FROM pg_constraint
WHERE conname = 'setlist_songs_song_id_fkey';
-- confdeltype should be 'r' (RESTRICT), not 'c' (CASCADE)
```

### Step 2: Check for Supabase Backup (Fastest Recovery Option)

1. Go to your Supabase Dashboard → Database → Backups
2. Look for a backup from **before** you deleted the song
3. If available, you can restore the `setlist_songs` table from that backup

**This is the fastest option if you have a recent backup!**

### Step 3: Bulk Restore from setlist.fm (Automated)

If no backup is available, use the automated bulk restore script:

```bash
# First, do a dry run to see what would happen
python scripts/bulk_restore_from_setlistfm.py --dry-run

# If it looks good, run the actual restoration
python scripts/bulk_restore_from_setlistfm.py

# Or restore just a few shows for testing
python scripts/bulk_restore_from_setlistfm.py --limit 5
```

**Requirements:**
- Python 3.7+
- setlist.fm API key (get at https://www.setlist.fm/settings/api)
- Add to `.env`: `SETLIST_FM_API_KEY=your_key_here`

**What it does:**
1. Finds all 142 shows with empty setlists
2. Searches setlist.fm for each show by date
3. Automatically imports the setlist data
4. Provides detailed progress reporting
5. Handles rate limiting (1 request/second)

**Estimated time:** ~3-5 minutes for all 142 shows

## Recovery Options Comparison

| Option | Speed | Accuracy | Requirements |
|--------|-------|----------|--------------|
| **Supabase Backup** | ⚡ Fastest (minutes) | 100% | Recent backup available |
| **Bulk Import Script** | 🚀 Fast (3-5 min) | ~95% | setlist.fm API key |
| **Manual Restoration** | 🐌 Slow (days) | 100% | Time and patience |

## Detailed Instructions

### Option A: Supabase Backup Restoration

**Best if:** You have a backup from before the deletion

1. **Find the backup:**
   - Supabase Dashboard → Database → Backups
   - Identify backup timestamp before deletion

2. **Restore the table:**
   - Use Supabase's point-in-time recovery
   - Restore only the `setlist_songs` table
   - Verify data after restoration

3. **Verify restoration:**
   ```sql
   -- Should return 0 (no empty shows)
   SELECT COUNT(DISTINCT s.id) 
   FROM shows s
   LEFT JOIN setlist_songs ss ON s.id = ss.show_id
   WHERE ss.id IS NULL;
   ```

### Option B: Bulk Import from setlist.fm (Recommended)

**Best if:** No recent backup available

1. **Get setlist.fm API key:**
   - Go to https://www.setlist.fm/settings/api
   - Create an application
   - Copy your API key

2. **Add to `.env` file:**
   ```
   SETLIST_FM_API_KEY=your_api_key_here
   ```

3. **Install Python dependencies:**
   ```bash
   cd scripts
   pip install -r requirements.txt
   ```

4. **Run dry run first:**
   ```bash
   python scripts/bulk_restore_from_setlistfm.py --dry-run
   ```

5. **Review the output, then run actual restoration:**
   ```bash
   python scripts/bulk_restore_from_setlistfm.py
   ```

6. **Monitor progress:**
   - Script shows progress for each show
   - Reports success/failure for each
   - Final statistics at the end

7. **Verify restoration:**
   ```bash
   node scripts/find_empty_setlists.js
   ```
   Should show 0 empty shows (or only future shows without setlists)

### Option C: Manual Restoration

**Best if:** Only a few shows need restoration

1. **Get list of affected shows:**
   ```bash
   node scripts/find_empty_setlists.js
   ```

2. **For each show:**
   - Find the show on setlist.fm
   - Use the admin panel to add songs manually
   - Or create a restore script like `restore_sept17_2025_setlist.js`

## Verification Steps

After restoration, verify the data:

### 1. Check for empty shows
```bash
node scripts/find_empty_setlists.js
```

### 2. Verify total setlist count
```sql
SELECT COUNT(*) FROM setlist_songs;
-- Should be significantly higher than before restoration
```

### 3. Check specific shows
```sql
-- September 17, 2025 should have 41 songs
SELECT COUNT(*) 
FROM setlist_songs ss
JOIN shows s ON ss.show_id = s.id
WHERE s.show_date = '2025-09-17';
```

### 4. Verify user stats
- Check the Stats tab in the app
- Verify play counts look correct
- Check that songs seen/not seen counts are reasonable

## Troubleshooting

### "setlist.fm API key not found"
- Make sure `SETLIST_FM_API_KEY` is in your `.env` file
- Restart the script after adding the key

### "Setlist not found on setlist.fm"
- Some shows may not be on setlist.fm
- These will need manual restoration
- Check the error log for which shows failed

### "Rate limit exceeded"
- The script has built-in rate limiting (1 req/sec)
- If you still hit limits, wait a few minutes and resume
- Use `--limit` to process in smaller batches

### Import fails for specific shows
- Check the error message in the output
- May need to manually restore those shows
- Common issues: venue name mismatch, date format issues

## Prevention Checklist

After recovery, ensure this doesn't happen again:

- [x] Database constraint changed to RESTRICT
- [ ] Test song deletion in admin panel (should show error)
- [ ] Update admin UI to show usage count before deletion
- [ ] Enable regular Supabase backups
- [ ] Document the proper song deletion workflow
- [ ] Add integration tests for deletion constraints

## Support

If you encounter issues:

1. Check the error messages in the script output
2. Review the `URGENT_DATA_LOSS_RECOVERY.md` file
3. Check Supabase logs for database errors
4. Verify your API keys are correct

## Timeline

**Immediate (Now):**
- ✅ Apply database constraint fix

**Within 1 hour:**
- Check for Supabase backup
- Get setlist.fm API key

**Within 24 hours:**
- Run bulk restoration script
- Verify all data restored

**Within 1 week:**
- Update admin UI
- Add tests
- Document workflow

