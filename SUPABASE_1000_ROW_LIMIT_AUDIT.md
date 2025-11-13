# Supabase 1000 Row Limit - Complete Audit

**Date**: 2025-11-12  
**Issue**: Supabase has a default 1000-row limit on queries. Queries that might return more than 1000 rows need pagination.

---

## ✅ Already Fixed (Confirmed Working)

### 1. **SearchPage - Song Stats Calculation**
- **File**: `client/src/pages/SearchPage.jsx` (lines 186-298)
- **Status**: ✅ **FIXED** (Nov 12, 2025)
- **Query**: Fetches setlist_songs for filtered shows to calculate covers/originals
- **Solution**: Implemented pagination with `.range()` in batches of 1000
- **Current data**: 1440 setlist_songs for 51 shows in 2025
- **Pattern**:
  ```javascript
  while (hasMore) {
      const { data: pageData } = await supabase
          .from('setlist_songs')
          .select('...')
          .in('show_id', batchIds)
          .range(rangeStart, rangeEnd);
      // ... pagination logic
  }
  ```

### 2. **Global Song Stats Endpoint**
- **File**: `server/routes/songs.js` (lines 20-73)
- **Status**: ✅ **FIXED** (Nov 11, 2025)
- **Query**: Fetches all setlist_songs to count performances per song
- **Solution**: Batch fetching with `.range()`
- **Current data**: ~5,899 setlist_songs

### 3. **Song Stats Global Endpoint**
- **File**: `server/routes/songs.js` (lines 76-135)
- **Status**: ✅ **FIXED** (Nov 11, 2025)
- **Query**: Fetches all setlist_songs for global statistics
- **Solution**: Batch fetching with `.range()`

### 4. **User Stats Endpoint**
- **File**: `server/routes/users.js` (lines 286-393)
- **Status**: ✅ **FIXED**
- **Query**: Fetches setlist_songs for attended shows
- **Solution**: Pagination with `.range()`

---

### 5. **SearchPage - Dropdown Songs Fetch**
- **File**: `client/src/pages/SearchPage.jsx` (lines 102-146)
- **Status**: ✅ **FIXED** (Nov 12, 2025)
- **Query**: Fetches ALL setlist_songs to populate song dropdown
- **Current data**: ~5,899 setlist_songs
- **Solution**: Implemented pagination with `.range()` in batches of 1000

### 6. **GET /api/songs/:id - Song Performances**
- **File**: `server/routes/songs.js` (lines 241-286)
- **Status**: ✅ **FIXED** (Nov 12, 2025)
- **Query**: Fetches all performances of a single song
- **Current data**: Most songs < 100 performances, but popular songs could exceed 1000
- **Solution**: Implemented pagination with `.range()` in batches of 1000

### 7. **GET /api/search/shows - Search by Song**
- **File**: `server/routes/search.js` (lines 132-164)
- **Status**: ✅ **FIXED** (Nov 12, 2025)
- **Query**: Fetches all shows where a song was played
- **Current data**: Most songs < 100 performances
- **Solution**: Implemented pagination with `.range()` in batches of 1000

---

## 🟡 MONITOR - Medium Priority (User-Facing)

### 8. **GET /api/venues/:id - Venue Shows**
- **File**: `server/routes/venues.js` (lines 49-53)
- **Status**: 🟡 **MONITOR**
- **Query**: Fetches all shows at a venue
- **Current data**: Red Rocks has most shows (~20)
- **Risk**: LOW - Unlikely to reach 1000 shows at one venue
- **Alert threshold**: 900 shows at any venue
- **Code**:
  ```javascript
  const { data: shows } = await supabase
      .from('shows')
      .select('*')
      .eq('venue_id', id)
      .order('show_date', { ascending: false });
  ```

### 9. **GET /api/users/shows - User Attended Shows**
- **File**: `server/routes/users.js` (lines 109-128)
- **Status**: 🟡 **MONITOR**
- **Query**: Fetches all shows a user has attended
- **Current data**: Most users < 50 shows
- **Risk**: LOW - Unlikely for a user to attend 1000+ shows
- **Alert threshold**: 900 attended shows per user
- **Code**:
  ```javascript
  const { data: userShows } = await supabase
      .from('user_shows')
      .select(`...`)
      .eq('user_id', user.id)
      .order('shows(show_date)', { ascending: false });
  ```

---

## 🟢 ADMIN PANEL - Safe (Low Priority)

### 11. **GET /api/songs - Admin Songs List**
- **File**: `server/routes/songs.js` (lines 9-19)
- **Status**: 🟢 **SAFE**
- **Query**: Fetches all songs for admin panel
- **Current data**: 134 songs
- **Risk**: LOW - Unlikely to reach 1000 songs
- **Alert threshold**: 900 songs
- **Note**: Admin panel uses client-side filtering

### 12. **GET /api/albums - Admin Albums List**
- **File**: `server/routes/albums.js` (lines 9-21)
- **Status**: 🟢 **SAFE**
- **Query**: Fetches all albums for admin panel
- **Current data**: ~10 albums
- **Risk**: NONE - Will never reach 1000 albums

### 13. **GET /api/venues - Admin Venues List**
- **File**: `server/routes/venues.js` (lines 9-21)
- **Status**: 🟢 **SAFE**
- **Query**: Fetches all venues for admin panel
- **Current data**: ~50 venues
- **Risk**: LOW - Unlikely to reach 1000 venues
- **Alert threshold**: 900 venues

### 14. **GET /api/search/songs - Song Search**
- **File**: `server/routes/search.js` (lines 188-217)
- **Status**: 🟢 **SAFE**
- **Query**: Searches songs by title/type
- **Current data**: 134 songs
- **Risk**: LOW - Unlikely to reach 1000 songs
- **Alert threshold**: 900 songs

### 15. **GET /api/shows - Admin Shows List**
- **File**: `server/routes/shows.js` (lines 9-42)
- **Status**: ✅ **ALREADY PAGINATED**
- **Query**: Fetches shows with pagination (20 per page)
- **Current data**: 302 shows
- **Note**: Already uses `.range()` with pagination parameters

### 10. **GET /api/users/stats - Songs Not Seen**
- **File**: `server/routes/users.js` (lines 416-462)
- **Status**: ✅ **FIXED** (Nov 12, 2025)
- **Query**: Fetches setlist_songs for songs not seen by user
- **Current data**: Varies by user
- **Solution**: Implemented pagination with `.range()` in batches of 1000

---

### 16. **GET /api/shows/:id - Single Show Setlist**
- **File**: `server/routes/shows.js` (lines 80-101)
- **Status**: ✅ **SAFE**
- **Query**: Fetches setlist for a single show
- **Max possible**: ~50 songs per show
- **Risk**: NONE

### 17. **SearchPage - Fetch Shows for Dropdowns**
- **File**: `client/src/pages/SearchPage.jsx` (lines 59-70)
- **Status**: 🟡 **MONITOR**
- **Query**: Fetches all shows for dropdown options
- **Current data**: 302 shows
- **Risk**: LOW - Will need pagination when shows reach 1000
- **Alert threshold**: 900 shows

---

## ✅ All Critical Issues Fixed

All high and medium priority issues have been resolved as of Nov 12, 2025:
- ✅ SearchPage dropdown songs fetch (Issue #5)
- ✅ Song detail page performances (Issue #6)
- ✅ Search by song (Issue #7)
- ✅ User stats songs not seen (Issue #10)

The application now properly handles the 1000-row limit across all critical queries.

---

## 🛠️ Standard Pagination Pattern

Use this pattern for all fixes:

```javascript
let allData = [];
let rangeStart = 0;
const PAGE_SIZE = 1000;
let hasMore = true;

while (hasMore) {
    const rangeEnd = rangeStart + PAGE_SIZE - 1;
    
    const { data: pageData, error, count } = await supabase
        .from('table_name')
        .select('*', { count: 'exact' })
        .eq('filter_field', filterValue)
        .range(rangeStart, rangeEnd);
    
    if (error) {
        console.error('Error:', error);
        break;
    }
    
    if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData);
        rangeStart += PAGE_SIZE;
        
        // Stop if we got less than a full page or reached the total count
        if (pageData.length < PAGE_SIZE || allData.length >= count) {
            hasMore = false;
        }
    } else {
        hasMore = false;
    }
}
```

---

---

## 📊 Summary

**Total Queries Audited**: 17
**Fixed**: 8
**Monitoring**: 4 (user-facing)
**Admin Panel Safe**: 5 (low data volume)

**Last Updated**: 2025-11-12
**Next Review**: When shows reach 800 or any song reaches 900 performances

