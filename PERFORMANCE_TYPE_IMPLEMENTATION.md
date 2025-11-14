# Performance Type Feature Implementation

## Overview
Added support for tracking different types of song performances (full, tease, partial) in setlists.

## Changes Made

### 1. Database Migration
**File:** `scripts/migrations/add_performance_type.sql`
- Added `performance_type` column to `setlist_songs` table
- Type: `TEXT NOT NULL DEFAULT 'full'`
- CHECK constraint: `performance_type IN ('full', 'tease', 'partial')`
- Created index for faster queries
- All existing data defaults to 'full'

**To apply migration:**
1. Open Supabase SQL Editor
2. Paste contents of `scripts/migrations/add_performance_type.sql`
3. Click "Run"

### 2. Backend API Changes

#### `server/routes/shows.js`
- **GET /api/shows/:id** - Added `performance_type` to setlist query and response
- **PUT /api/shows/:id/setlist** - Added validation and support for `performance_type` field
- **POST /api/shows/:id/setlist/song** - Added validation and support for `performance_type` field
- Validates that `performance_type` is one of: 'full', 'tease', 'partial'
- Defaults to 'full' if not provided

#### `server/routes/songs.js`
- **GET /api/songs** - Added `performance_type` to setlist_songs queries
- **GET /api/songs/:id** - Returns `performance_type_counts` object with counts for each type:
  ```json
  {
    "performance_type_counts": {
      "full": 42,
      "tease": 3,
      "partial": 1
    },
    "total_performances": 46
  }
  ```
- **GET /api/songs/stats/global** - Added `performance_type` to queries

#### `server/routes/users.js`
- Added `performance_type` to all setlist_songs queries

### 3. Frontend Changes

#### `client/src/components/SetlistEditor.jsx`
- Added `performance_type: 'full'` to new song objects
- Added dropdown control in SetlistSongItem component with options:
  - Full Performance
  - Tease
  - Partial
- Includes `performance_type` in API format conversion
- Defaults to 'full' for new entries

#### `client/src/pages/ShowDetailPage.jsx`
- Added performance type badges for all sets (Set 1, Set 2, Set 3, Encore):
  - **Tease** - Yellow badge
  - **Partial** - Orange badge
- Added legend at top of setlist explaining badges:
  - Tease = Brief snippet without full vocals
  - Partial = Incomplete performance
  - > = Jams into next song
- Badges appear before Cover badge in display order

### 4. Import Script
**File:** `scripts/import_from_setlistfm.py`
- Added `performance_type: 'full'` to setlist_song entries
- setlist.fm doesn't distinguish teases, so all imports default to 'full'

## Testing Checklist

### Database
- [ ] Apply migration in Supabase SQL Editor
- [ ] Verify column exists: `SELECT performance_type FROM setlist_songs LIMIT 1;`
- [ ] Verify constraint works: Try inserting invalid value

### Backend API
- [ ] Test GET /api/shows/:id returns performance_type
- [ ] Test PUT /api/shows/:id/setlist accepts performance_type
- [ ] Test POST /api/shows/:id/setlist/song accepts performance_type
- [ ] Test validation rejects invalid performance_type values
- [ ] Test GET /api/songs/:id returns performance_type_counts

### Frontend - Setlist Editor
- [ ] Open admin setlist editor
- [ ] Expand a song item
- [ ] Verify "Performance Type" dropdown appears
- [ ] Change to "Tease" and save
- [ ] Verify it persists after page reload

### Frontend - Show Detail Page
- [ ] View a show with setlist
- [ ] Verify legend appears at top of setlist
- [ ] Mark a song as "Tease" in editor
- [ ] Verify yellow "Tease" badge appears on show detail page
- [ ] Test with "Partial" as well

### Import Script
- [ ] Run import script for a test show
- [ ] Verify imported songs have performance_type = 'full'

## API Examples

### Add song with tease
```javascript
POST /api/shows/:id/setlist/song
{
  "song_id": "uuid-here",
  "set_number": 1,
  "song_order": 5,
  "is_encore": false,
  "performance_type": "tease",
  "notes": "Brief snippet during jam"
}
```

### Update entire setlist
```javascript
PUT /api/shows/:id/setlist
[
  {
    "song_id": "uuid-1",
    "set_number": 1,
    "song_order": 1,
    "is_encore": false,
    "performance_type": "full"
  },
  {
    "song_id": "uuid-2",
    "set_number": 1,
    "song_order": 2,
    "is_encore": false,
    "performance_type": "tease"
  }
]
```

## Notes
- All existing setlist entries will have `performance_type = 'full'` after migration
- The field is required (NOT NULL) with a default value
- Frontend defaults to 'full' for new entries
- Backend validates the value on insert/update
- Import script defaults to 'full' since setlist.fm doesn't track teases

