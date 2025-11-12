# Albums Table Migration

## Overview

This migration adds support for associating original songs with albums. This enables album breakdown statistics for shows, tours, and more.

## What This Migration Does

1. **Creates `albums` table** with the following columns:
   - `id` (UUID, primary key)
   - `title` (TEXT, unique) - Album name
   - `artist_name` (TEXT) - Artist name (defaults to 'Johnny Blue Skies')
   - `release_date` (DATE) - Album release date
   - `album_art_url` (TEXT) - URL to album artwork
   - `album_type` (TEXT) - Type: 'studio', 'live', 'compilation', 'ep', 'single'
   - `notes` (TEXT) - Additional notes
   - `created_at` (TIMESTAMP)
   - `updated_at` (TIMESTAMP)

2. **Adds `album_id` column to `songs` table**
   - Nullable foreign key to `albums` table
   - Only populated for original songs (covers will have `album_id = NULL`)
   - ON DELETE SET NULL (if album is deleted, songs remain but lose album association)

3. **Inserts initial album data** for Johnny Blue Skies / Sturgill Simpson:
   - High Top Mountain (2013)
   - Metamodern Sounds in Country Music (2014)
   - A Sailor's Guide to Earth (2016)
   - Sound & Fury (2019)
   - Cuttin' Grass Vol. 1 - The Butcher Shoppe Sessions (2020)
   - Cuttin' Grass Vol. 2 - The Cowboy Arms Sessions (2020)
   - The Ballad of Dood & Juanita (2021)
   - Passage Du Desir (2024)

4. **Sets up Row Level Security (RLS) policies**
   - Public read access to albums
   - Admin-only write access (insert, update, delete)

## How to Run This Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `add_albums_table.sql`
5. Paste into the SQL editor
6. Click **Run** or press `Ctrl+Enter`
7. Verify success by checking the **Table Editor** for the new `albums` table

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push
```

Or run the SQL file directly:

```bash
psql -h <your-supabase-host> -U postgres -d postgres -f scripts/migrations/add_albums_table.sql
```

## Verification

After running the migration, verify it worked:

1. **Check albums table exists:**
   ```sql
   SELECT * FROM albums ORDER BY release_date;
   ```
   Should return 8 albums.

2. **Check album_id column was added to songs:**
   ```sql
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'songs' AND column_name = 'album_id';
   ```
   Should return one row showing the `album_id` column.

3. **Run the verification script:**
   ```bash
   node scripts/run_albums_migration.js
   ```

## Next Steps After Migration

1. **Update Songs with Album Associations**
   - Go to Admin Panel > Songs
   - Edit each original song and select its album from the dropdown
   - Covers should have no album selected (album_id = NULL)

2. **Add Album Stats to UI**
   - Show album breakdown in show details
   - Add album filter to search
   - Display album artwork in setlists

3. **Create Album Management Admin Panel** (optional)
   - Add/edit/delete albums
   - Upload album artwork
   - Manage album metadata

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove album_id column from songs table
ALTER TABLE songs DROP COLUMN IF EXISTS album_id;

-- Drop albums table
DROP TABLE IF EXISTS albums CASCADE;
```

**⚠️ WARNING:** This will permanently delete all album data and associations!

## Database Schema Changes

### Before Migration
```
songs
├── id
├── title
├── is_original
├── original_artist
├── written_by
├── lyrics
├── notes
├── created_at
└── updated_at
```

### After Migration
```
songs
├── id
├── title
├── is_original
├── original_artist
├── written_by
├── lyrics
├── notes
├── album_id  ← NEW (nullable FK to albums)
├── created_at
└── updated_at

albums  ← NEW TABLE
├── id
├── title
├── artist_name
├── release_date
├── album_art_url
├── album_type
├── notes
├── created_at
└── updated_at
```

## API Changes

### New Endpoints

- `GET /api/albums` - Get all albums
- `GET /api/albums/:id` - Get album with songs
- `POST /api/albums` - Create album (admin only)
- `PUT /api/albums/:id` - Update album (admin only)
- `DELETE /api/albums/:id` - Delete album (admin only)

### Updated Endpoints

- `POST /api/songs` - Now accepts `album_id` field
- `PUT /api/songs/:id` - Now accepts `album_id` field
- `GET /api/songs/:id` - Now returns `album_id` in response

## Future Enhancements

- Album artwork display in setlists
- Album-based filtering and search
- Album statistics (most played album, etc.)
- Album era grouping for tours
- Vinyl/CD/Digital release tracking
- Chart positions and awards

---

**Migration Date:** 2025-11-12  
**Author:** BlueskiesBase Development Team  
**Status:** Ready to deploy (local testing only - do not push to GitHub yet)

