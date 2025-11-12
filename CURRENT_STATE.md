# BlueskiesBase - Current State Document

**Last Updated:** November 12, 2025  
**Project Status:** Production (with critical bug requiring immediate fix)

---

## 🚨 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION

### 1. Data Loss Bug in Setlist Update Endpoint (SEVERITY: CRITICAL)

**Location:** `server/routes/shows.js` - PUT `/api/shows/:id/setlist` (lines 266-327)

**Problem:**
The endpoint deletes ALL existing setlist entries BEFORE validating and inserting new data. If the insert operation fails for ANY reason, the original data is permanently lost.

**What Happened:**
- User attempted to save a show on September 16, 2025
- The save failed due to `jams_into` type error (using `false` instead of `null`)
- All setlist entries for that show were deleted before the error occurred
- The show now has 0 songs in its setlist
- Data cannot be recovered from setlist.fm (future date or not published yet)

**Current Vulnerable Code Pattern:**
```javascript
// Step 1: DELETE all existing entries
await supabase.from('setlist_songs').delete().eq('show_id', id);

// Step 2: INSERT new entries (IF THIS FAILS, DATA IS GONE!)
await supabase.from('setlist_songs').insert(setlistEntries);
```

**Required Fix:**
Implement transaction-safe update with validation:
```javascript
// Step 1: VALIDATE all data first
// - Check all song_ids exist
// - Check all data types are correct
// - Check for null/undefined values

// Step 2: Only if validation passes, proceed with update
// Option A: Use database transaction (if Supabase supports)
// Option B: Insert to temp table, validate, then swap
// Option C: Keep old entries until new ones succeed, then delete old

// Step 3: Add rollback capability
// Step 4: Add audit logging of what was deleted
```

**Impact:** HIGH - Any admin edit to a setlist can cause permanent data loss

**Priority:** CRITICAL - Must fix before any more setlist edits

**Affected Shows:**
- September 16, 2025 - Red Rocks Amphitheatre (Show ID: `7e34e678-91dc-4457-8840-752d678f3ea9`) - **LOST ALL SETLIST DATA**

---

### 2. Missing Setlist Data for September 16, 2025

**Show Details:**
- **Date:** 2025-09-16
- **Venue:** Red Rocks Amphitheatre, Morrison
- **Show ID:** `7e34e678-91dc-4457-8840-752d678f3ea9`
- **Current Setlist:** 0 songs (data lost)

**Recovery Options:**
1. Wait for setlist.fm to publish the setlist (if it's a future show)
2. Manual data entry if user has the setlist information
3. Check if there's a database backup (currently no backup system exists)

**Status:** UNRESOLVED - Awaiting user input on how to recover

---

## ✅ Recently Completed Work

### Performance Count Feature (Completed: Nov 12, 2025)
- Added "Shows" column to Songs admin panel
- Displays number of performances for each song
- Clickable links navigate to search results filtered by that song
- Implemented batch fetching to handle all 5,868 setlist entries accurately
- **Commit:** `7ecf04d`

### Bug Fixes (Completed: Nov 12, 2025)
- Fixed `jams_into` type error (changed `false` to `null`)
- Removed excessive console.log statements causing Railway rate limit
- **Commit:** `6e4b20d`
- **Note:** This fix prevents future errors but doesn't solve the data loss vulnerability

---

## 📊 Current Database State

### Statistics
- **Total Shows:** 302
- **Total Songs:** 137
- **Total Setlist Entries:** 5,868 (down from 5,869 due to Sept 16 data loss)
- **Total Albums:** 8
- **Total Venues:** ~200+
- **Songs with Performances:** 133
- **Songs Never Performed:** 4
- **Songs with Jams Into Relationships:** 32

### Top 10 Most Performed Songs
1. It Ain't All Flowers - 236 shows
2. Turtles All the Way Down - 231 shows
3. The Promise (Cover) - 230 shows
4. Long White Line - 220 shows
5. Brace for Impact (Live a Little) - 201 shows
6. Welcome to Earth (Pollywog) - 196 shows
7. Living the Dream - 191 shows
8. Life of Sin - 183 shows
9. Call to Arms - 172 shows
10. You Don't Miss Your Water - 167 shows

### Data Quality Issues

**Duplicate Songs:**
- "The Promise (Cover)" exists twice:
  - `7a714d35-e547-4b45-8b25-0923be56be71` - 231 performances (ACTIVE)
  - `669ad0c4-47eb-464b-bc7d-ac3a80f4417f` - 0 performances (UNUSED - can be deleted)

**Data Inconsistencies:**
- Songs with "(Cover)" in title but `is_original = true`
- Example: "The Promise (Cover)" marked as original

---

## 🏗️ Architecture Overview

### Frontend (React + Vite)
**Location:** `client/` directory

**Key Pages:**
- `SearchPage.jsx` - Main search with filters
- `ShowDetailPage.jsx` - Individual show details with setlist
- `StatsPage.jsx` - User attendance statistics
- `admin/ShowsList.jsx` - Admin show management
- `admin/SongsList.jsx` - Admin song management
- `admin/AlbumsList.jsx` - Admin album management
- `admin/SetlistEditor.jsx` - Drag-and-drop setlist editor

**Key Features:**
- Tailwind CSS v3 dark theme
- React Router for navigation
- Supabase client for authentication
- Mobile responsive design

### Backend (Node.js + Express)
**Location:** `server/` directory

**Key Routes:**
- `routes/shows.js` - Show CRUD and setlist management
- `routes/songs.js` - Song CRUD and statistics
- `routes/albums.js` - Album CRUD
- `routes/venues.js` - Venue management
- `routes/users.js` - User authentication and stats

**Key Middleware:**
- `middleware/auth.js` - JWT authentication and admin authorization

### Database (Supabase/PostgreSQL)

**Core Tables:**
```
songs (137 rows)
├── id (UUID, PK)
├── title (TEXT)
├── is_original (BOOLEAN)
├── original_artist (TEXT, nullable)
├── written_by (TEXT, nullable)
├── album_id (UUID, FK to albums, nullable)
├── lyrics (TEXT, nullable)
└── notes (TEXT, nullable)

albums (8 rows)
├── id (UUID, PK)
├── title (TEXT)
├── artist_name (TEXT)
├── release_date (DATE, nullable)
├── album_art_url (TEXT, nullable)
├── album_type (TEXT)
└── notes (TEXT, nullable)

shows (302 rows)
├── id (UUID, PK)
├── show_date (DATE)
├── venue_id (UUID, FK to venues)
├── artist_name (TEXT)
├── tour_name (TEXT, nullable)
├── notes (TEXT, nullable)
├── poster_url (TEXT, nullable)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

setlist_songs (5,868 rows) - JUNCTION TABLE
├── id (UUID, PK)
├── show_id (UUID, FK to shows, CASCADE DELETE)
├── song_id (UUID, FK to songs, CASCADE DELETE)
├── set_number (INTEGER)
├── song_order (INTEGER)
├── is_encore (BOOLEAN)
├── notes (TEXT, nullable)
├── jams_into (UUID, FK to songs, nullable, CASCADE DELETE)
└── created_at (TIMESTAMP)

venues (~200+ rows)
├── id (UUID, PK)
├── name (TEXT)
├── city (TEXT)
├── state (TEXT, nullable)
├── country (TEXT)
└── setlistfm_id (TEXT, nullable)

user_shows (user attendance tracking)
├── id (UUID, PK)
├── user_id (UUID, FK to auth.users)
├── show_id (UUID, FK to shows)
└── created_at (TIMESTAMP)

user_notes (user-generated content)
├── id (UUID, PK)
├── user_id (UUID, FK to auth.users)
├── show_id (UUID, FK to shows)
├── note_text (TEXT)
├── is_approved (BOOLEAN)
└── created_at (TIMESTAMP)

user_photos (user-uploaded photos)
├── id (UUID, PK)
├── user_id (UUID, FK to auth.users)
├── show_id (UUID, FK to shows)
├── photo_url (TEXT)
├── caption (TEXT, nullable)
├── is_approved (BOOLEAN)
└── created_at (TIMESTAMP)
```

**Important Relationships:**
- `setlist_songs.song_id` → `songs.id` (CASCADE DELETE)
- `setlist_songs.jams_into` → `songs.id` (CASCADE DELETE)
- Deleting a song will delete ALL related setlist entries
- Always check `performance_count` before deleting songs

---

## 🔧 Development Environment

### Local Setup
```bash
# Backend
npm install
npm run dev  # Runs on http://localhost:3000

# Frontend
cd client
npm install
npm run dev  # Runs on http://localhost:5173
```

### Environment Variables
```env
SUPABASE_URL=<your_supabase_url>
SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
SETLISTFM_API_KEY=<your_setlistfm_api_key>
PORT=3000
```

### Admin Access
**Admin email:** info@danlevy.net  
**Defined in:** `server/middleware/auth.js`

---

## 🚀 Deployment

### Frontend (Vercel)
- **URL:** https://blueskiesbase.vercel.app (or similar)
- **Auto-deploy:** Pushes to `main` branch trigger deployment
- **Build command:** `npm run build`
- **Output directory:** `dist`

### Backend (Railway)
- **Auto-deploy:** Pushes to `main` branch trigger deployment
- **Start command:** `node app.js`
- **Environment:** Node.js
- **Rate limit:** 500 logs/sec (watch for excessive logging)

---

## 📝 Immediate Action Items

### Priority 1: Critical (Do First)
1. ✅ **Fix data loss bug in setlist update endpoint**
   - Implement validation before deletion
   - Add transaction safety
   - Add rollback capability
   - Test thoroughly before deploying

2. ✅ **Restore September 16, 2025 setlist**
   - Get setlist data from user or wait for setlist.fm
   - Manually enter data or import when available

3. ✅ **Set up automated backups**
   - Daily database snapshots
   - Store in secure location
   - Test restore process

### Priority 2: High (Do Soon)
4. ✅ **Add audit logging**
   - Track all admin changes (who, what, when)
   - Store in separate audit table
   - Include before/after snapshots

5. ✅ **Delete duplicate "The Promise (Cover)" song**
   - Verify 0 performances: `node scripts/check_song_references.js 669ad0c4-47eb-464b-bc7d-ac3a80f4417f`
   - Delete unused duplicate

6. ✅ **Fix data inconsistencies**
   - Review songs with "(Cover)" in title
   - Correct `is_original` flag or remove "(Cover)" from title

### Priority 3: Medium (Do When Possible)
7. ✅ **Add undo functionality for admin**
8. ✅ **Improve error handling and user feedback**
9. ✅ **Add comprehensive data validation**
10. ✅ **Performance monitoring and optimization**

---

## 📚 Useful Scripts

```bash
# Check if a song can be safely deleted
node scripts/check_song_references.js <song_id>

# Verify performance counts are accurate
node scripts/verify_song_counts.js

# Import shows from setlist.fm
python scripts/import_setlists.py

# Check specific show's setlist
node scripts/check_show_setlist.js

# Find shows with missing setlists
node scripts/find_missing_show.js
```

---

## 🐛 Known Bugs and Limitations

1. **CRITICAL:** Setlist update can cause data loss (see top of document)
2. No automated backups - data loss is permanent
3. No audit logging - can't track who made changes
4. No undo functionality - mistakes are permanent
5. setlist.fm API sometimes returns 403 errors
6. No rate limiting on public API endpoints
7. No caching - every request hits database
8. Search doesn't support fuzzy matching
9. No batch operations for admin tasks
10. Mobile UX could be improved

---

## 📞 Support Information

**Repository:** https://github.com/dlevy/BlueskiesBase  
**Frontend:** Vercel (auto-deploy)  
**Backend:** Railway (auto-deploy)  
**Database:** Supabase

**For new AI assistant sessions:**
1. Read `PROJECT_INSTRUCTIONS.md` first
2. Read this `CURRENT_STATE.md` document
3. Check for critical issues at the top
4. Review recent commits for context
5. Test locally before pushing changes

