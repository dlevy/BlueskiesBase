# 🚨 QUICK RECOVERY - 3 Simple Steps

## ⚠️ CRITICAL: 142 shows have lost their setlist data!

---

## Step 1: Fix Database (5 minutes) ⚡ DO THIS FIRST!

**Open Supabase SQL Editor and run:**

```sql
ALTER TABLE public.setlist_songs DROP CONSTRAINT IF EXISTS setlist_songs_song_id_fkey;
ALTER TABLE public.setlist_songs ADD CONSTRAINT setlist_songs_song_id_fkey 
FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE RESTRICT;
```

**This prevents future data loss. Do this NOW before anything else!**

---

## Step 2: Get setlist.fm API Key (2 minutes)

1. Go to: https://www.setlist.fm/settings/api
2. Create an application (any name is fine)
3. Copy your API key
4. Add to your `.env` file:
   ```
   SETLIST_FM_API_KEY=your_key_here
   ```

---

## Step 3: Run Bulk Restore (3-5 minutes)

```bash
# Test first (dry run)
python scripts/bulk_restore_from_setlistfm.py --dry-run

# If it looks good, run the actual restoration
python scripts/bulk_restore_from_setlistfm.py
```

**That's it! The script will automatically:**
- Find all 142 shows with empty setlists
- Search setlist.fm for each show
- Import all the setlist data
- Show you progress and results

---

## Verify It Worked

```bash
node scripts/find_empty_setlists.js
```

Should show 0 empty shows (or only future shows without setlists yet).

---

## Need Help?

- **Full details:** See `RECOVERY_GUIDE.md`
- **Technical docs:** See `URGENT_DATA_LOSS_RECOVERY.md`
- **What happened:** See `CRITICAL_FIX_SONG_DELETE.md`

---

## What Happened?

When you deleted a song, the database's `ON DELETE CASCADE` constraint deleted ALL setlist entries for that song across ALL shows. This affected 142 shows (32% of your database).

**The fix:** Changed the constraint to `ON DELETE RESTRICT` so songs can't be deleted if they're used in any setlists.

---

## Timeline

- **Now:** Fix database constraint (Step 1)
- **Next 10 min:** Get API key and run restore (Steps 2-3)
- **Done!** All 142 shows restored

Total time: ~10-15 minutes

