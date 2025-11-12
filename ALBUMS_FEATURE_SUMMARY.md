# Albums Feature Implementation Summary

## 🎯 Overview

Implemented Option 1: Add `album_id` column to `songs` table with a separate `albums` table for managing album metadata. This allows associating original songs with their studio/live albums for album breakdown statistics.

---

## ✅ What's Been Created

### 1. Database Migration

**File:** `scripts/migrations/add_albums_table.sql`

Creates:
- `albums` table with full metadata (title, artist, release date, artwork URL, type, notes)
- `album_id` column in `songs` table (nullable foreign key)
- Row Level Security policies (public read, admin write)
- Initial data for 8 Johnny Blue Skies / Sturgill Simpson albums

**Albums Included:**
1. High Top Mountain (2013) - studio
2. Metamodern Sounds in Country Music (2014) - studio
3. A Sailor's Guide to Earth (2016) - studio
4. Sound & Fury (2019) - studio
5. Cuttin' Grass Vol. 1 (2020) - live
6. Cuttin' Grass Vol. 2 (2020) - live
7. The Ballad of Dood & Juanita (2021) - studio
8. Passage Du Desir (2024) - studio

---

### 2. Backend API Routes

**File:** `server/routes/albums.js`

New endpoints:
- `GET /api/albums` - Get all albums (ordered by release date)
- `GET /api/albums/:id` - Get album with all its songs
- `POST /api/albums` - Create new album (admin only)
- `PUT /api/albums/:id` - Update album (admin only)
- `DELETE /api/albums/:id` - Delete album (admin only, sets songs.album_id to NULL)

**File:** `server/routes/songs.js` (updated)

Updated endpoints to include `album_id`:
- `POST /api/songs` - Now accepts `album_id` in request body
- `PUT /api/songs/:id` - Now accepts `album_id` in request body
- `GET /api/songs/stats/global` - Now includes `album_id` in song data

---

### 3. Server Configuration

**File:** `app.js` (updated)

Added albums route:
```javascript
app.use('/api/albums', require('./server/routes/albums'));
```

---

### 4. Migration Scripts

**File:** `scripts/run_albums_migration.js`

Verification script that:
- Checks if albums table was created successfully
- Verifies album_id column was added to songs
- Lists all albums in the database
- Provides next steps guidance

**File:** `scripts/migrations/README.md`

Comprehensive migration guide with:
- Step-by-step instructions for running the migration
- Verification steps
- Rollback instructions
- API changes documentation
- Future enhancement ideas

---

## 📋 How to Deploy (Local Testing)

### Step 1: Run the Database Migration

**Option A: Supabase Dashboard (Recommended)**
1. Go to Supabase Dashboard > SQL Editor
2. Copy contents of `scripts/migrations/add_albums_table.sql`
3. Paste and run the SQL
4. Verify in Table Editor that `albums` table exists

**Option B: Supabase CLI**
```bash
supabase db push
```

### Step 2: Verify Migration

```bash
node scripts/run_albums_migration.js
```

Should output:
- ✅ Albums table created with 8 albums
- ✅ Songs table updated - album_id column added

### Step 3: Test API Endpoints

```bash
# Get all albums
curl http://localhost:3000/api/albums

# Get specific album with songs
curl http://localhost:3000/api/albums/{album-id}
```

### Step 4: Restart Backend Server

```bash
npm run dev
```

The albums routes are now available!

---

## 🎨 Next Steps (Frontend - Not Yet Implemented)

### 1. Admin Panel - Album Management

Create `client/src/pages/admin/AlbumsList.jsx`:
- List all albums
- Add/edit/delete albums
- Upload album artwork
- Manage album metadata

### 2. Admin Panel - Song Form Update

Update `client/src/pages/admin/SongsList.jsx`:
- Add "Album" dropdown when editing/creating original songs
- Fetch albums from `/api/albums`
- Only show dropdown if `is_original = true`
- Save `album_id` when submitting form

### 3. Show Detail Page - Album Breakdown

Update `client/src/pages/ShowDetailPage.jsx`:
- Add "Album Breakdown" section showing:
  - "5 songs from Passage Du Desir"
  - "3 songs from High Top Mountain"
  - "2 songs from A Sailor's Guide to Earth"
- Display album artwork thumbnails
- Link to album detail page (future)

### 4. Song Statistics - Album Stats

Update `client/src/components/SongStatsWidget.jsx`:
- Add "Most Played Albums" section
- Show album breakdown for originals
- Display album artwork

### 5. Search/Filter - Album Filter

Update `client/src/pages/SearchPage.jsx`:
- Add "Album" dropdown filter
- Filter shows by songs from specific album
- "Show me all shows that played songs from Passage Du Desir"

---

## 🗄️ Database Schema

### albums Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | TEXT | Album name (unique) |
| artist_name | TEXT | Artist name |
| release_date | DATE | Release date |
| album_art_url | TEXT | Album artwork URL |
| album_type | TEXT | 'studio', 'live', 'compilation', 'ep', 'single' |
| notes | TEXT | Additional notes |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### songs Table (Updated)

| Column | Type | Description |
|--------|------|-------------|
| ... | ... | (existing columns) |
| **album_id** | **UUID** | **Foreign key to albums (nullable)** |

**Relationship:**
- One album has many songs
- One song belongs to one album (or none if cover)
- `album_id` is NULL for covers
- `album_id` references `albums.id` with ON DELETE SET NULL

---

## 🔒 Security (RLS Policies)

### albums Table

- **SELECT**: Public (anyone can read albums)
- **INSERT**: Admin only
- **UPDATE**: Admin only
- **DELETE**: Admin only

---

## 📊 Example Queries

### Get all songs from an album

```sql
SELECT s.* 
FROM songs s
JOIN albums a ON s.album_id = a.id
WHERE a.title = 'Passage Du Desir'
ORDER BY s.title;
```

### Get album breakdown for a show

```sql
SELECT 
    a.title as album_title,
    COUNT(DISTINCT s.id) as song_count
FROM setlist_songs ss
JOIN songs s ON ss.song_id = s.id
LEFT JOIN albums a ON s.album_id = a.id
WHERE ss.show_id = '{show-id}'
    AND s.is_original = true
GROUP BY a.id, a.title
ORDER BY song_count DESC;
```

### Get most played album

```sql
SELECT 
    a.title,
    COUNT(DISTINCT ss.show_id) as times_played
FROM setlist_songs ss
JOIN songs s ON ss.song_id = s.id
JOIN albums a ON s.album_id = a.id
GROUP BY a.id, a.title
ORDER BY times_played DESC
LIMIT 10;
```

---

## 🚀 Future Enhancements

1. **Album Detail Page**
   - Full album information
   - Track listing
   - All shows that played songs from this album
   - Album statistics

2. **Album Artwork Display**
   - Show album covers in setlists
   - Album artwork in search results
   - Album carousel on homepage

3. **Album Era Filtering**
   - "High Top Mountain Era" (2013-2014)
   - "Metamodern Era" (2014-2016)
   - Filter shows by album era

4. **Album Statistics**
   - Most played album overall
   - Most played album per tour
   - Album diversity score for shows
   - "Deep cuts" from each album

5. **Album Upload/Management**
   - Upload album artwork to Supabase Storage
   - Batch import album data from MusicBrainz API
   - Track multiple releases (vinyl, CD, digital)

---

## ⚠️ Important Notes

1. **Do NOT push to GitHub yet** - User requested to work locally tonight
2. **Covers should have `album_id = NULL`** - Only originals get album associations
3. **Manual data entry required** - After migration, admin must manually associate existing songs with albums
4. **Album deletion is safe** - ON DELETE SET NULL means deleting an album won't delete songs, just removes the association

---

## 📝 Files Created/Modified

### Created:
- `scripts/migrations/add_albums_table.sql`
- `scripts/run_albums_migration.js`
- `scripts/migrations/README.md`
- `server/routes/albums.js`
- `ALBUMS_FEATURE_SUMMARY.md` (this file)

### Modified:
- `app.js` - Added albums route
- `server/routes/songs.js` - Added album_id to POST/PUT endpoints and queries

---

**Status:** ✅ Backend implementation complete, ready for local testing  
**Next:** Run migration, test API, then build admin UI for album management  
**Do NOT push to GitHub until user approval**

