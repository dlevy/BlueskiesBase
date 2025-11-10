# 🚀 Quick Start: Import from setlist.fm

## Step-by-Step Guide to Import Johnny Blue Skies (Sturgill Simpson) Setlists

---

## ✅ **Step 1: Run the Database Migration**

### **Open Supabase Dashboard:**

1. Go to https://supabase.com/dashboard
2. Select your **BlueskiesBase** project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### **Run the Migration:**

1. Open the file: `database/migration_setlistfm_compatibility.sql`
2. Copy the entire contents
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl+Enter)

### **Verify Success:**

You should see:
```
Migration completed successfully!
Added setlist.fm compatibility fields to:
  - venues (setlistfm_id, coordinates, country info)
  - shows (setlistfm_id, version_id, url, info)
  - songs (musicbrainz_id, setlistfm_url)
  - setlist_songs (is_cover, original_artist) - CRITICAL FIX
Created artists table with RLS policies
Created helper functions for data import
```

✅ **Migration complete!**

---

## ✅ **Step 2: Get setlist.fm API Key**

### **Register (if needed):**

1. Go to https://www.setlist.fm/signup
2. Create a free account
3. Verify your email

### **Apply for API Key:**

1. Go to https://www.setlist.fm/settings/api
2. Fill out the application form:
   - **Application name:** BlueskiesBase
   - **Description:** Personal setlist database for Johnny Blue Skies (Sturgill Simpson)
   - **URL:** http://localhost:5174 (or your domain)
3. Submit the application
4. Wait for approval (usually within a few hours)

### **Save Your API Key:**

Once approved, you'll receive an API key. Save it - you'll need it next!

---

## ✅ **Step 3: Add API Key to Environment**

### **Update your `.env` file:**

Open your `.env` file in the root directory and add:

```env
# Existing variables
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Add this new line:
SETLIST_FM_API_KEY=your_setlistfm_api_key_here
```

**Replace `your_setlistfm_api_key_here` with your actual API key!**

---

## ✅ **Step 4: Install Python Dependencies**

### **Open a terminal in your project directory:**

```powershell
# Navigate to your project
cd "C:\Users\info\Documents\VSCode Projects\BlueskiesBase"

# Install Python dependencies
pip install -r scripts/requirements.txt
```

This installs:
- `setlist-fm-client` - Python client for setlist.fm API
- `python-dotenv` - Load environment variables
- `supabase` - Python client for Supabase

---

## ✅ **Step 5: Run the Import Script**

### **Import Johnny Blue Skies (Sturgill Simpson) Setlists:**

```powershell
# Import 50 most recent setlists
python scripts/import_from_setlistfm.py --artist "Sturgill Simpson" --limit 50
```

### **What It Does:**

1. 🔍 Searches for "Sturgill Simpson" on setlist.fm
2. 📥 Fetches the 50 most recent setlists (includes Johnny Blue Skies shows)
3. 🏛️ Creates venues with coordinates
4. 🎸 Creates artist entry
5. 🎵 Creates songs (with cover detection)
6. 📝 Builds complete setlists
7. ⏭️ Skips duplicates automatically

### **Expected Output:**

```
🎸 BlueskiesBase - setlist.fm Importer
============================================================
🔍 Searching for artist: Sturgill Simpson
✅ Found artist: Sturgill Simpson (mbid: f6e61750-a6b7-4d88-979b-052345cd0e4a)
  ✅ Created artist: Sturgill Simpson
📥 Fetching setlists (limit: 50)...
✅ Found 50 setlists

🚀 Starting import of 50 setlists...

📅 Importing setlist: 2025-02-15
  ✅ Created venue: Ryman Auditorium, Nashville
  ✅ Created show: 2025-02-15
  ✅ Imported 22 songs

📅 Importing setlist: 2025-02-14
  ✅ Created show: 2025-02-14
  ✅ Imported 21 songs

...

============================================================
📊 IMPORT STATISTICS
============================================================
Setlists processed:  50
Setlists imported:   50
Setlists skipped:    0
Venues created:      25
Artists created:     1
Songs created:       45
Errors:              0
============================================================

✅ Import complete!
```

---

## 🎯 **Step 6: View Your Data**

### **Check the Admin Panel:**

1. Go to http://localhost:5174/login
2. Log in with your admin credentials
3. Go to **Shows**: http://localhost:5174/admin/shows
4. You should see all the imported shows! 🎉

### **Check the Public Site:**

1. Go to http://localhost:5174
2. Search by year: **2024**
3. See all the imported setlists!

---

## 🔧 **Advanced Options**

### **Import More Setlists:**

```powershell
# Import 100 setlists
python scripts/import_from_setlistfm.py --artist "Sturgill Simpson" --limit 100

# Import ALL 443 setlists (as of Nov 2025)
python scripts/import_from_setlistfm.py --artist "Sturgill Simpson" --limit 500
```

### **Import Different Artist:**

```powershell
# Import Tyler Childers setlists
python scripts/import_from_setlistfm.py --artist "Tyler Childers" --limit 50

# Import Jason Isbell setlists
python scripts/import_from_setlistfm.py --artist "Jason Isbell" --limit 50
```

### **Re-run Import:**

The script automatically skips duplicates, so you can safely re-run it:

```powershell
# This will skip already imported shows
python scripts/import_from_setlistfm.py --artist "Sturgill Simpson" --limit 50
```

---

## 📊 **What Gets Imported**

### **Venues:**
- ✅ Name, city, state/country
- ✅ Geographic coordinates (latitude/longitude)
- ✅ Country codes
- ✅ setlist.fm ID and URL

### **Shows:**
- ✅ Date, artist, venue
- ✅ Tour name
- ✅ Show notes
- ✅ setlist.fm ID and URL
- ✅ Last updated timestamp

### **Songs:**
- ✅ Song titles
- ✅ Cover detection (automatic!)
- ✅ Original artist for covers
- ✅ MusicBrainz IDs

### **Setlists:**
- ✅ Complete song order
- ✅ Set numbers (Set 1, Set 2, Set 3)
- ✅ Encore detection
- ✅ Cover song tracking
- ✅ Song notes (teases, guests, etc.)

---

## ⚠️ **Troubleshooting**

### **Error: "SETLIST_FM_API_KEY not set"**

**Solution:** Add your API key to the `.env` file:
```env
SETLIST_FM_API_KEY=your_key_here
```

### **Error: "Artist not found"**

**Solution:** Check the artist name spelling:
```powershell
# Try with exact spelling
python scripts/import_from_setlistfm.py --artist "Sturgill Simpson"

# Note: Johnny Blue Skies shows are under "Sturgill Simpson" on setlist.fm
```

### **Error: "No setlists found"**

**Possible causes:**
- Artist has no setlists on setlist.fm
- API rate limit reached (wait a few minutes)
- Network connection issue

### **Error: Database connection failed**

**Solution:** Check your `.env` file has correct Supabase credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 💡 **Tips**

### **Start Small:**
- Import 10-20 setlists first to test
- Check the data in your app
- Then import more

### **API Rate Limits:**
- setlist.fm has rate limits
- If you get errors, wait a few minutes
- Import in batches (50-100 at a time)

### **Data Quality:**
- setlist.fm data is community-sourced
- Some setlists may be incomplete
- You can edit them in your admin panel!

### **Duplicates:**
- Script automatically skips duplicates
- Safe to re-run anytime
- Won't create duplicate shows

---

## 🎉 **Success!**

You should now have:
- ✅ Database migrated with setlist.fm compatibility
- ✅ Python import script installed
- ✅ Black Crowes setlists imported
- ✅ Venues with coordinates
- ✅ Songs with cover detection
- ✅ Complete setlists ready to view

---

## 🚀 **Next Steps**

1. **Browse your data** in the admin panel
2. **Edit setlists** if needed
3. **Add more shows** manually
4. **Import more artists** if desired

---

## 📝 **Summary of Commands**

```powershell
# 1. Install dependencies
pip install -r scripts/requirements.txt

# 2. Import setlists
python scripts/import_from_setlistfm.py --artist "Sturgill Simpson" --limit 50

# 3. View in browser
# http://localhost:5174/admin/shows
```

---

**Your setlist database is now powered by setlist.fm!** 🎸

Check out your imported data at: http://localhost:5174

