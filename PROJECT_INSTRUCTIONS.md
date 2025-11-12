# BlueskiesBase Project Instructions

## Project Overview

BlueskiesBase is a full-stack setlist database application for Johnny Blue Skies (Sturgill Simpson) concerts, similar to Crowesbase.com. It allows users to search shows, view setlists, track attendance, and includes a comprehensive admin panel for managing shows, songs, albums, and setlists.

**Tech Stack:**
- **Frontend:** React + Vite + Tailwind CSS v3
- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel (frontend), Railway (backend)
- **External API:** setlist.fm API for importing concert data

---

## Critical Lessons Learned

### 1. **NEVER Use Boolean `false` for UUID Foreign Keys**

**Problem:** The `jams_into` field in `setlist_songs` table is a UUID foreign key to the `songs` table. Using `false` as a default value causes type mismatch errors.

**Solution:** Always use `null` for empty UUID foreign keys:
```javascript
// ❌ WRONG - causes database errors
jams_into: item.jams_into || false

// ✅ CORRECT - UUID or null
jams_into: item.jams_into || null
```

**Where to check:**
- `server/routes/shows.js` - PUT `/api/shows/:id/setlist` endpoint
- `server/routes/shows.js` - POST `/api/shows/:id/setlist/song` endpoint
- Any other endpoints that insert/update `setlist_songs` table

---

### 2. **Supabase Has a 1,000 Row Default Limit**

**Problem:** Queries return only the first 1,000 rows by default, causing inaccurate counts and incomplete data.

**Solution:** Use batch fetching for large datasets:
```javascript
let allData = [];
let from = 0;
const batchSize = 1000;
let hasMore = true;

while (hasMore) {
    const { data: batch, error } = await supabase
        .from('table_name')
        .select('*')
        .range(from, from + batchSize - 1);
    
    if (error) break;
    
    if (batch && batch.length > 0) {
        allData = allData.concat(batch);
        hasMore = batch.length === batchSize;
        from += batchSize;
    } else {
        hasMore = false;
    }
}
```

**Where this matters:**
- Performance counts (counting songs across all shows)
- Any aggregation across large datasets
- Exporting data

---

### 3. **Supabase Foreign Key Ambiguity**

**Problem:** When a table has multiple foreign keys to the same table, Supabase requires explicit FK names.

**Solution:** Use explicit foreign key syntax:
```javascript
// ❌ WRONG - ambiguous when multiple FKs exist
.select('*, songs(*)')

// ✅ CORRECT - explicit FK name
.select('*, songs!setlist_songs_song_id_fkey(*)')
```

**Tables with this issue:**
- `setlist_songs` table (has `song_id` and `jams_into` both pointing to `songs`)

---

### 4. **Data Loss Prevention - Transaction Safety**

**CRITICAL PROBLEM:** The current `PUT /api/shows/:id/setlist` endpoint deletes all setlist entries BEFORE inserting new ones. If the insert fails, data is permanently lost.

**Current Flawed Pattern:**
```javascript
// ❌ DANGEROUS - data loss if insert fails
await supabase.from('setlist_songs').delete().eq('show_id', id);
await supabase.from('setlist_songs').insert(newEntries);  // If this fails, data is gone!
```

**Required Fix (NOT YET IMPLEMENTED):**
```javascript
// ✅ SAFE - validate first, then delete and insert
// 1. Validate all song_ids exist
// 2. Validate all data types are correct
// 3. Only then delete old entries
// 4. Insert new entries
// 5. If insert fails, rollback or restore from backup
```

**Alternative Approach:**
- Use database transactions (if Supabase supports them)
- Or: Insert into temporary table first, validate, then swap
- Or: Keep old entries until new ones are successfully inserted, then delete old ones

---

### 5. **Excessive Logging Causes Railway Rate Limits**

**Problem:** Railway has a 500 logs/sec rate limit. Logging large JSON objects on every request causes dropped logs and performance issues.

**Solution:**
- Remove verbose `console.log` statements in production code
- Only log errors and critical events
- Never log entire request bodies or large datasets

**Example:**
```javascript
// ❌ BAD - floods logs
console.log('[PUT /setlist] Setlist data:', JSON.stringify(setlist, null, 2));
console.log('[PUT /setlist] Inserting entries:', JSON.stringify(setlistEntries, null, 2));

// ✅ GOOD - minimal logging
console.error('[PUT /setlist] Error inserting setlist:', error);
```

---

### 6. **Single Source of Truth for Song Metadata**

**Architecture Rule:** The `songs` table is the ONLY canonical source for song metadata.

**What belongs in `songs` table:**
- `title` - Song title
- `is_original` - Whether it's an original or cover
- `original_artist` - Artist who originally wrote/performed the song
- `written_by` - Songwriter credits
- `album_id` - Which album the song appears on
- `lyrics` - Song lyrics
- `notes` - General notes about the song

**What belongs in `setlist_songs` table (junction table only):**
- `show_id` - Which show
- `song_id` - Which song (FK to songs table)
- `set_number` - Which set (1, 2, 3, etc.)
- `song_order` - Order within the set
- `is_encore` - Whether this was an encore performance
- `notes` - Performance-specific notes (e.g., "acoustic version", "with special guest")
- `jams_into` - UUID of the next song if it jams directly into it (FK to songs table)

**Never store song metadata in `setlist_songs`** - it creates data inconsistency and duplication.

---

### 7. **Database Schema Overview**

**Core Tables:**
- `songs` - Canonical song information (137 songs)
- `albums` - Album information (8 albums)
- `shows` - Show information (302 shows)
- `venues` - Venue information
- `setlist_songs` - Junction table linking shows to songs (5,868 entries)
- `user_shows` - User attendance tracking
- `user_notes` - User-generated notes for shows
- `user_photos` - User-uploaded photos for shows

**Key Relationships:**
- `songs.album_id` → `albums.id` (nullable)
- `setlist_songs.song_id` → `songs.id` (CASCADE DELETE)
- `setlist_songs.jams_into` → `songs.id` (nullable, CASCADE DELETE)
- `setlist_songs.show_id` → `shows.id` (CASCADE DELETE)
- `shows.venue_id` → `venues.id`

**CASCADE DELETE Warning:**
- Deleting a song will delete ALL setlist entries for that song
- Always check `performance_count` before deleting songs
- Use `scripts/check_song_references.js` to verify safety

---

### 8. **Package Management**

**Always use package managers** instead of manually editing package files:

```bash
# ✅ CORRECT
npm install package-name
npm uninstall package-name

# ❌ WRONG
# Manually editing package.json
```

**Rationale:** Package managers handle version resolution, dependency conflicts, and lock files automatically.

---

### 9. **Testing Before Deployment**

**Always test changes locally before pushing:**

1. **Backend changes:** Restart server and test API endpoints
2. **Frontend changes:** Check browser console for errors
3. **Database changes:** Run migration scripts with dry-run mode first
4. **Data imports:** Test on small dataset before full import

**Use curl to test backend:**
```bash
curl -s http://localhost:3000/api/songs | node -e "..."
```

---

### 10. **Git Commit Best Practices**

**Commit message format:**
```
type: Brief description

- Detailed change 1
- Detailed change 2
- Detailed change 3

Fixes: Description of what bug was fixed
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `chore:` - Maintenance tasks

---

## Current Database Stats

- **Total shows:** 302
- **Total songs:** 137
- **Total setlist entries:** 5,868
- **Total albums:** 8
- **Songs with performances:** 133
- **Songs never performed:** 4
- **Songs with jams_into relationships:** 32

**Top 5 Most Performed Songs:**
1. It Ain't All Flowers - 236 shows
2. Turtles All the Way Down - 231 shows
3. The Promise (Cover) - 230 shows
4. Long White Line - 220 shows
5. Brace for Impact (Live a Little) - 201 shows

---

## Environment Variables Required

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# setlist.fm API
SETLISTFM_API_KEY=your_setlistfm_api_key

# Server
PORT=3000
```

---

## Running the Application

**Development:**
```bash
# Backend (from root)
npm run dev

# Frontend (from client/)
cd client
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

---

## Admin Panel Access

**Admin users are defined in:** `server/middleware/auth.js`

**Admin email addresses:**
- info@danlevy.net

**Admin routes:**
- `/admin/shows` - Manage shows
- `/admin/songs` - Manage songs
- `/admin/albums` - Manage albums

---

## Useful Scripts

**Check song references before deletion:**
```bash
node scripts/check_song_references.js <song_id>
```

**Verify song counts:**
```bash
node scripts/verify_song_counts.js
```

**Import from setlist.fm:**
```bash
python scripts/import_setlists.py
```

**Database migrations:**
```bash
node scripts/migrations/run_migration.js
```

---

## Known Issues and Technical Debt

### CRITICAL - Data Loss Prevention (NOT YET FIXED)

**Issue:** The `PUT /api/shows/:id/setlist` endpoint can cause permanent data loss.

**What happened:** September 16, 2025 show lost its entire setlist when a save operation failed due to the `jams_into` type error.

**Root cause:** The endpoint deletes all existing setlist entries BEFORE validating and inserting new ones. If the insert fails, the data is gone forever.

**Impact:** HIGH - Can cause permanent data loss

**Priority:** CRITICAL - Must fix before any more admin edits

**Required fix:**
1. Implement transaction-safe update pattern
2. Validate all data BEFORE deleting existing entries
3. Consider using database transactions or temporary tables
4. Add rollback capability
5. Consider keeping audit log of deletions

**File:** `server/routes/shows.js` - lines 266-327

---

## Future Enhancements

1. **Backup system** - Automated daily backups of critical data
2. **Audit logging** - Track all admin changes with timestamps and user info
3. **Undo functionality** - Allow admins to undo recent changes
4. **Data validation** - More robust validation before database operations
5. **Error recovery** - Automatic recovery from failed operations
6. **Performance optimization** - Caching for frequently accessed data
7. **Search improvements** - Full-text search, fuzzy matching
8. **Mobile app** - Native mobile applications
9. **API rate limiting** - Prevent abuse of public endpoints
10. **Analytics** - Track popular songs, venues, attendance trends

---

## Contact and Support

**Repository:** https://github.com/dlevy/BlueskiesBase
**Deployments:**
- Frontend: Vercel (auto-deploy from main branch)
- Backend: Railway (auto-deploy from main branch)

---

## Important Notes for AI Assistants

1. ✅ ~~**Always check for the `jams_into || false` pattern**~~ - **FIXED 2025-11-12** - All instances corrected to use `null`
2. **Always use batch fetching** for queries that might return >1000 rows
3. ✅ ~~**Never delete data before validating new data**~~ - **FIXED 2025-11-12** - Validation-first pattern implemented
4. **Always test locally** before pushing to production
5. **Check Railway logs** for rate limit warnings
6. **Use explicit FK names** when querying tables with multiple FKs to same table
7. **Respect the single source of truth** - song metadata only in `songs` table
8. **Check performance_count** before deleting songs
9. **Use package managers** for dependency management
10. **Document all database schema changes** in migration scripts

---

## Current State Summary (Last Updated: 2025-11-12)

### ✅ Completed Features

**Core Functionality:**
- ✅ Search page with filters (year, month, venue, city, song, source)
- ✅ Show detail page with full setlist display
- ✅ User authentication (email/password via Supabase)
- ✅ User attendance tracking ("I Was There" functionality)
- ✅ User stats page (shows attended, songs seen, songs not seen)
- ✅ User-generated content (notes and photos with moderation)
- ✅ Poster upload functionality
- ✅ Content filters (Has Notes, Has Photos, Has Poster)
- ✅ Pagination for search results (50 shows per page)
- ✅ Shareable URLs with client-side routing
- ✅ Dark theme UI with Tailwind CSS v3
- ✅ Mobile responsive design
- ✅ Cascading filters with auto-search
- ✅ Timezone-aware date display

**Admin Panel:**
- ✅ Admin authentication and authorization
- ✅ Shows management (CRUD operations)
- ✅ Setlist editor with drag-and-drop
- ✅ Songs management (CRUD operations)
- ✅ Albums management (CRUD operations)
- ✅ Performance count column in songs list (with clickable links to search)
- ✅ Batch import from setlist.fm API (443 shows imported)
- ✅ "Jams Into" feature with purple ">" badges
- ✅ Admin panel link in footer for admin users

**Data Quality:**
- ✅ 302 shows imported from setlist.fm
- ✅ 134 songs in database (cleaned up duplicates)
- ✅ 5,899 setlist entries (restored September 16, 2025 show)
- ✅ 8 albums created
- ✅ Combined songs split into individual songs with jams_into relationships
- ✅ Orphaned data cleanup
- ✅ Duplicate song detection and removal
- ✅ Data loss prevention with validation-first pattern (2025-11-12)

**Performance Optimizations:**
- ✅ Batch attendance checking (avoid N+1 queries)
- ✅ Stats page pagination
- ✅ Batch fetching for performance counts (handles 5,868 entries)

**Deployment:**
- ✅ Frontend deployed to Vercel
- ✅ Backend deployed to Railway
- ✅ Auto-deployment from GitHub main branch
- ✅ Environment variables configured

### 🚨 Critical Issues (MUST FIX IMMEDIATELY)

**None - All critical issues have been resolved!** ✅

### ✅ Recently Resolved Critical Issues

**1. Data Loss in Setlist Update Endpoint** ✅ **FIXED - 2025-11-12**
- **File:** `server/routes/shows.js` - PUT `/api/shows/:id/setlist` endpoint (lines 266-438)
- **Issue:** Was deleting all setlist entries BEFORE validating new data
- **Impact:** September 16, 2025 show lost its entire setlist when save failed
- **Fix Applied:** Implemented comprehensive validation-first pattern:
  - Validates all required fields (song_id, set_number, song_order)
  - Validates UUID format for song_id and jams_into
  - Verifies all song references exist in database
  - Verifies show exists
  - Only deletes old data AFTER all validation passes
  - Fixed jams_into to use `null` instead of `false` (UUID field)
- **Commit:** `5928c16` - Deployed to production
- **Status:** ✅ RESOLVED

**2. Missing Setlist Data for September 16, 2025 Show** ✅ **FIXED - 2025-11-12**
- **Show ID:** `7e34e678-91dc-4457-8840-752d678f3ea9`
- **Venue:** Red Rocks Amphitheatre, Morrison
- **Date:** 2025-09-16
- **Fix Applied:** Restored all 31 songs from setlist.fm
- **Script:** `scripts/restore_sept16_2025_setlist.js`
- **Commit:** `026fa6e` - Deployed to production
- **Status:** ✅ RESOLVED - Show now has complete setlist

### ⚠️ Known Issues (Lower Priority)

1. **Data inconsistency:** Songs with "(Cover)" in title but `is_original = true`
   - Example: "The Promise (Cover)" marked as original
   - **Action:** Review and fix is_original flag or remove "(Cover)" from title

2. **No audit logging:** No record of who made what changes when
   - **Impact:** Can't track down source of data issues
   - **Action:** Implement audit logging for all admin actions

3. **No backup system:** No automated backups of database
   - **Impact:** Data loss is permanent
   - **Action:** Set up automated daily backups

### 📋 Immediate Next Steps (Priority Order)

1. ~~**FIX DATA LOSS BUG**~~ ✅ **COMPLETED 2025-11-12** - Implemented transaction-safe setlist update
2. ~~**Restore September 16, 2025 setlist**~~ ✅ **COMPLETED 2025-11-12** - Restored all 31 songs from setlist.fm
3. ~~**Delete duplicate "The Promise (Cover)" song**~~ ✅ **COMPLETED** - Cleaned up unused duplicate
4. **Add audit logging** - Track all admin changes (NEXT PRIORITY)
5. **Set up automated backups** - Daily database snapshots
6. **Fix data inconsistencies** - Review songs with "(Cover)" in title
7. **Add undo functionality** - Allow admins to revert recent changes
8. **Improve error handling** - Better user feedback on failures
9. **Add data validation** - Prevent invalid data from being saved
10. **Performance monitoring** - Track slow queries and optimize

### 🎯 Future Enhancements (Backlog)

- Full-text search with fuzzy matching
- Advanced analytics (popular songs, venue trends, attendance patterns)
- Mobile native apps (iOS/Android)
- API rate limiting and abuse prevention
- Caching layer for frequently accessed data
- Batch operations for admin (bulk edit, bulk delete)
- Export functionality (CSV, JSON)
- Public API for third-party integrations
- Song lyrics display
- Video/audio embedding for performances
- Tour date predictions based on historical data
- Social features (comments, ratings, favorites)

---

## Quick Reference: Common Tasks

### Add a new song
1. Go to `/admin/songs`
2. Click "Add New Song"
3. Fill in title, type (original/cover), artist, writer, album
4. Save

### Edit a setlist
1. Go to `/admin/shows`
2. Find the show and click "Edit"
3. Use the setlist editor to add/remove/reorder songs
4. Click "Save Show"
5. **WARNING:** Current implementation can cause data loss if save fails

### Check if a song can be deleted
```bash
node scripts/check_song_references.js <song_id>
```

### Import shows from setlist.fm
```bash
python scripts/import_setlists.py
```

### Verify performance counts are accurate
```bash
node scripts/verify_song_counts.js
```

