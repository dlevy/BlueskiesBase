# 🎵 setlist.fm API Integration Plan

## Overview

This document analyzes the compatibility between your BlueskiesBase database schema and the setlist.fm API, and provides a plan for populating your database using their API.

---

## 📊 Current Database Schema vs setlist.fm API

### **Your Current Schema:**

#### **venues table:**
```sql
- id (UUID)
- name (TEXT)
- city (TEXT)
- state_country (TEXT)
- address (TEXT)
- created_at
- updated_at
```

#### **shows table:**
```sql
- id (UUID)
- venue_id (UUID FK)
- show_date (DATE)
- artist_name (TEXT)
- tour_name (TEXT)
- notes (TEXT)
- has_images (BOOLEAN)
- source_types (TEXT[])
- created_at
- updated_at
```

#### **songs table:**
```sql
- id (UUID)
- title (TEXT)
- original_artist (TEXT)
- is_original (BOOLEAN)
- written_by (TEXT)
- lyrics (TEXT)
- notes (TEXT)
- created_at
- updated_at
```

#### **setlist_songs table:**
```sql
- id (UUID)
- show_id (UUID FK)
- song_id (UUID FK)
- set_number (INTEGER)
- song_order (INTEGER)
- notes (TEXT)
- is_encore (BOOLEAN)
- is_cover (BOOLEAN)  -- MISSING in schema.sql!
- original_artist (TEXT)  -- MISSING in schema.sql!
- created_at
```

---

## 🔍 setlist.fm API Data Structure

Based on the setlist.fm API documentation and Python client, here's what their API returns:

### **Setlist Response:**
```json
{
  "id": "string",
  "versionId": "string",
  "eventDate": "dd-MM-yyyy",
  "lastUpdated": "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
  "artist": {
    "mbid": "string",
    "name": "string",
    "sortName": "string",
    "disambiguation": "string",
    "url": "string"
  },
  "venue": {
    "id": "string",
    "name": "string",
    "city": {
      "id": "string",
      "name": "string",
      "state": "string",
      "stateCode": "string",
      "coords": {
        "lat": number,
        "long": number
      },
      "country": {
        "code": "string",
        "name": "string"
      }
    },
    "url": "string"
  },
  "tour": {
    "name": "string"
  },
  "sets": {
    "set": [
      {
        "name": "string",
        "encore": number,
        "song": [
          {
            "name": "string",
            "with": {
              "mbid": "string",
              "name": "string"
            },
            "cover": {
              "mbid": "string",
              "name": "string",
              "sortName": "string",
              "disambiguation": "string",
              "url": "string"
            },
            "info": "string",
            "tape": boolean
          }
        ]
      }
    ]
  },
  "info": "string",
  "url": "string"
}
```

---

## ⚠️ Schema Gaps & Recommendations

### **CRITICAL: Missing Fields in setlist_songs**

Your `setlist_songs` table is missing two fields that you're already using in your code:

```sql
-- ADD THESE TO database/schema.sql:
ALTER TABLE public.setlist_songs 
ADD COLUMN is_cover BOOLEAN DEFAULT FALSE,
ADD COLUMN original_artist TEXT;
```

### **Recommended Schema Enhancements for setlist.fm Compatibility:**

#### **1. venues table - Add setlist.fm fields:**
```sql
ALTER TABLE public.venues
ADD COLUMN setlistfm_id TEXT UNIQUE,
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8),
ADD COLUMN country_code TEXT,
ADD COLUMN country_name TEXT,
ADD COLUMN state_code TEXT,
ADD COLUMN setlistfm_url TEXT;
```

#### **2. shows table - Add setlist.fm fields:**
```sql
ALTER TABLE public.shows
ADD COLUMN setlistfm_id TEXT UNIQUE,
ADD COLUMN setlistfm_version_id TEXT,
ADD COLUMN setlistfm_url TEXT,
ADD COLUMN setlistfm_last_updated TIMESTAMP WITH TIME ZONE,
ADD COLUMN info TEXT;  -- General show info from setlist.fm
```

#### **3. songs table - Add setlist.fm fields:**
```sql
ALTER TABLE public.songs
ADD COLUMN musicbrainz_id TEXT UNIQUE,  -- MusicBrainz ID (mbid)
ADD COLUMN setlistfm_url TEXT;
```

#### **4. artists table - NEW TABLE (Recommended):**
```sql
CREATE TABLE public.artists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sort_name TEXT,
    musicbrainz_id TEXT UNIQUE,
    disambiguation TEXT,
    setlistfm_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Then modify shows table:
ALTER TABLE public.shows
ADD COLUMN artist_id UUID REFERENCES public.artists(id);

-- Keep artist_name for backward compatibility
```

---

## 🔧 Database Migration Script

Here's the complete migration to add setlist.fm compatibility:

```sql
-- =====================================================
-- MIGRATION: Add setlist.fm API compatibility
-- =====================================================

-- 1. Fix setlist_songs table (CRITICAL)
ALTER TABLE public.setlist_songs 
ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_artist TEXT;

-- 2. Enhance venues table
ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS setlistfm_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS country_name TEXT,
ADD COLUMN IF NOT EXISTS state_code TEXT,
ADD COLUMN IF NOT EXISTS setlistfm_url TEXT;

CREATE INDEX IF NOT EXISTS idx_venues_setlistfm_id ON public.venues(setlistfm_id);

-- 3. Enhance shows table
ALTER TABLE public.shows
ADD COLUMN IF NOT EXISTS setlistfm_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS setlistfm_version_id TEXT,
ADD COLUMN IF NOT EXISTS setlistfm_url TEXT,
ADD COLUMN IF NOT EXISTS setlistfm_last_updated TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS info TEXT;

CREATE INDEX IF NOT EXISTS idx_shows_setlistfm_id ON public.shows(setlistfm_id);

-- 4. Enhance songs table
ALTER TABLE public.songs
ADD COLUMN IF NOT EXISTS musicbrainz_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS setlistfm_url TEXT;

CREATE INDEX IF NOT EXISTS idx_songs_musicbrainz_id ON public.songs(musicbrainz_id);

-- 5. Create artists table (optional but recommended)
CREATE TABLE IF NOT EXISTS public.artists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sort_name TEXT,
    musicbrainz_id TEXT UNIQUE,
    disambiguation TEXT,
    setlistfm_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_name ON public.artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_musicbrainz_id ON public.artists(musicbrainz_id);

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Artists are viewable by everyone"
    ON public.artists FOR SELECT
    USING (true);

-- 6. Add artist_id to shows (optional)
ALTER TABLE public.shows
ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES public.artists(id);

CREATE INDEX IF NOT EXISTS idx_shows_artist_id ON public.shows(artist_id);
```

---

## 📥 Data Import Strategy

### **Step 1: Get setlist.fm API Key**

1. Register at https://www.setlist.fm/signup
2. Apply for API key at https://www.setlist.fm/settings/api
3. Set environment variable: `SETLIST_FM_API_KEY=your_key_here`

### **Step 2: Install Python Client**

```bash
pip install setlist-fm-client
```

### **Step 3: Create Import Script**

I'll create a Python script to import data from setlist.fm API into your database.

---

## 🎯 Field Mapping

### **setlist.fm → BlueskiesBase**

| setlist.fm Field | BlueskiesBase Field | Table | Notes |
|-----------------|---------------------|-------|-------|
| `id` | `setlistfm_id` | shows | Unique identifier |
| `versionId` | `setlistfm_version_id` | shows | Version tracking |
| `eventDate` | `show_date` | shows | Convert dd-MM-yyyy to DATE |
| `lastUpdated` | `setlistfm_last_updated` | shows | ISO timestamp |
| `artist.name` | `artist_name` | shows | Artist name |
| `artist.mbid` | `musicbrainz_id` | artists | MusicBrainz ID |
| `venue.name` | `name` | venues | Venue name |
| `venue.id` | `setlistfm_id` | venues | setlist.fm venue ID |
| `venue.city.name` | `city` | venues | City name |
| `venue.city.state` | `state_country` | venues | State/Province |
| `venue.city.stateCode` | `state_code` | venues | State code |
| `venue.city.country.code` | `country_code` | venues | Country code |
| `venue.city.country.name` | `country_name` | venues | Country name |
| `venue.city.coords.lat` | `latitude` | venues | Latitude |
| `venue.city.coords.long` | `longitude` | venues | Longitude |
| `tour.name` | `tour_name` | shows | Tour name |
| `sets.set[].song[].name` | `title` | songs | Song title |
| `sets.set[].song[].cover.name` | `original_artist` | setlist_songs | Cover artist |
| `sets.set[].song[].info` | `notes` | setlist_songs | Song notes |
| `sets.set[].encore` | `is_encore` | setlist_songs | Encore flag |
| `info` | `info` | shows | Show notes |
| `url` | `setlistfm_url` | shows | setlist.fm URL |

---

## 🚀 Next Steps

1. **Run the migration script** to add missing fields
2. **Install Python dependencies** for import script
3. **Get setlist.fm API key**
4. **Run import script** to populate database
5. **Test the data** in your app

---

## 💡 Benefits of setlist.fm Integration

### **Advantages:**
- ✅ **Massive database** - Millions of setlists already cataloged
- ✅ **Community-driven** - Constantly updated by fans
- ✅ **Rich metadata** - Venue coordinates, MusicBrainz IDs, etc.
- ✅ **Cover song tracking** - Automatically identifies covers
- ✅ **Tour information** - Tour names and dates
- ✅ **Guest appearances** - "with" field for collaborations

### **Considerations:**
- ⚠️ **API rate limits** - Be respectful with requests
- ⚠️ **Data quality** - Community-sourced, may have errors
- ⚠️ **Attribution** - Must credit setlist.fm per their terms
- ⚠️ **Black Crowes coverage** - Check if they have good coverage

---

## 📝 Import Script Preview

I can create a Python script that will:

1. Search for Black Crowes setlists
2. Parse the API response
3. Create/update venues with coordinates
4. Create/update shows with setlist.fm IDs
5. Create/update songs
6. Build complete setlists with cover information
7. Handle duplicates gracefully
8. Log progress and errors

Would you like me to create this import script?

---

## 🎸 Recommendation

**I recommend:**

1. **Run the migration** to add the missing `is_cover` and `original_artist` fields (CRITICAL)
2. **Add setlist.fm compatibility fields** (venues, shows, songs)
3. **Create the import script** to populate from setlist.fm
4. **Keep manual entry option** for shows not in setlist.fm

This gives you the best of both worlds:
- Bulk import from setlist.fm for historical data
- Manual entry for new shows or corrections
- Full compatibility with setlist.fm ecosystem

---

**Ready to proceed?** Let me know and I'll:
1. Create the migration SQL file
2. Build the Python import script
3. Update your schema documentation

