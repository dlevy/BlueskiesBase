# Supabase 1000 Row Limit - Monitoring Guide

## Overview

Supabase has a **default 1000 row limit** on queries. This document tracks which endpoints might be affected as the database grows.

---

## ✅ Already Fixed

### 1. `GET /api/songs/stats/global`
- **Location**: `server/routes/songs.js` (lines 37-73)
- **Status**: ✅ **FIXED** - Uses batch fetching (1000 rows per batch)
- **Current data**: ~5,836 setlist_songs
- **Solution**: Implemented while loop with `.range()` to fetch all records in batches

### 2. `GET /api/users/stats`
- **Location**: `server/routes/users.js` (lines 286-393)
- **Status**: ✅ **Already has batch fetching**
- **Current data**: Varies per user
- **Solution**: Already implemented pagination for setlist_songs queries

---

## 📊 Current Status (Safe)

### Shows: 443 / 1000 (44% capacity)
- **Endpoints affected**:
  - `GET /api/search/shows` (server/routes/search.js, line 75)
  - `GET /api/shows` (uses pagination, safe)

### Songs: 141 / 1000 (14% capacity)
- **Endpoints affected**:
  - `GET /api/songs` (server/routes/songs.js, line 11)
  - `GET /api/search/songs` (server/routes/search.js, line 184)

### Setlist Songs: ~5,836 (already handled with batch fetching)

---

## ⚠️ Action Required When Approaching Limits

### When Shows Reach ~900 (Currently: 443)

**Endpoint**: `GET /api/search/shows`
- **File**: `server/routes/search.js`
- **Line**: 75
- **Current code**:
  ```javascript
  const { data: shows, error } = await query;
  ```

**Action needed**: Implement batch fetching similar to song stats:
```javascript
let allShows = [];
let from = 0;
const batchSize = 1000;
let hasMore = true;

while (hasMore) {
    const { data: batch, error: batchError } = await query
        .range(from, from + batchSize - 1);
    
    if (batchError) {
        console.error('Error fetching shows batch:', batchError);
        return res.status(500).json({ error: 'Failed to search shows' });
    }
    
    if (batch && batch.length > 0) {
        allShows = allShows.concat(batch);
        from += batchSize;
        hasMore = batch.length === batchSize;
    } else {
        hasMore = false;
    }
}

const shows = allShows;
```

---

### When Songs Reach ~900 (Currently: 141)

**Endpoint**: `GET /api/songs`
- **File**: `server/routes/songs.js`
- **Line**: 11-14

**Action needed**: Add batch fetching or pagination

---

## 🔍 Low Risk Endpoints (Monitor but not urgent)

These endpoints are unlikely to hit the 1000 row limit in normal usage:

1. **`GET /api/songs/:id` - Song performances**
   - Would need a single song played 1000+ times
   - Current max: Much lower

2. **`GET /api/venues/:id` - Shows at venue**
   - Would need a single venue to host 1000+ shows
   - Current max: Much lower

3. **`GET /api/users/attended-shows`**
   - Would need a user to attend 1000+ shows
   - Unlikely for most users

4. **`GET /api/notes/show/:showId`**
   - Would need 1000+ notes on a single show
   - Very unlikely

5. **`GET /api/photos/show/:showId`**
   - Would need 1000+ photos on a single show
   - Very unlikely

---

## 📝 Monitoring Checklist

Run this query periodically to check current counts:

```sql
SELECT 
    (SELECT COUNT(*) FROM shows) as total_shows,
    (SELECT COUNT(*) FROM songs) as total_songs,
    (SELECT COUNT(*) FROM setlist_songs) as total_setlist_songs,
    (SELECT COUNT(*) FROM venues) as total_venues,
    (SELECT MAX(show_count) FROM (
        SELECT venue_id, COUNT(*) as show_count 
        FROM shows 
        GROUP BY venue_id
    ) as venue_shows) as max_shows_per_venue,
    (SELECT MAX(performance_count) FROM (
        SELECT song_id, COUNT(*) as performance_count 
        FROM setlist_songs 
        GROUP BY song_id
    ) as song_performances) as max_performances_per_song;
```

**Alert thresholds**:
- Shows: Alert at 900
- Songs: Alert at 900
- Shows per venue: Alert at 900
- Performances per song: Alert at 900

---

## 🛠️ Debug Scripts

Use these scripts to analyze the data:

1. **Find unplayed songs**: `node scripts/find_unplayed_songs.js`
2. **Debug song stats**: `node scripts/debug_song_stats.js`

---

## 📚 Reference

- **Supabase Documentation**: https://supabase.com/docs/guides/api/pagination
- **Related Issue**: Fixed song stats endpoint on 2025-11-11
- **Batch Fetching Pattern**: See `server/routes/songs.js` lines 37-73 for reference implementation

---

**Last Updated**: 2025-11-11
**Next Review**: When shows reach 800 or songs reach 800

