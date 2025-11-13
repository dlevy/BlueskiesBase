# BlueskiesBase Cleanup Plan

**Date:** November 12, 2025  
**Purpose:** Harden the app, remove unused files, and improve session management

---

## ✅ Session/Authentication Improvements (COMPLETED)

### Issues Fixed:
1. **Logout button not working** - Added proper error handling and state management
2. **Session corruption** - Improved signOut to clear local state immediately
3. **No visual feedback** - Added loading states and disabled buttons during logout
4. **Navigation issues** - Added explicit navigation to home after logout

### Changes Made:

#### `client/src/contexts/AuthContext.jsx`
- Enhanced `signOut()` function to clear local state immediately
- Added comprehensive error handling
- Clear user, profile, and session state even if Supabase signOut fails
- Better logging for debugging

#### `client/src/App.jsx`
- Added `useState` for `isSigningOut` loading state
- Added `useNavigate` for post-logout navigation
- Prevent double-clicks on logout button
- Show "Signing Out..." text during logout
- Disable button during logout process
- Navigate to home page after successful logout
- Alert user if logout fails

#### `client/src/pages/admin/AdminLayout.jsx`
- Same improvements as App.jsx for admin logout button
- Consistent UX across all logout buttons

---

## 📁 Files to Remove (Unused/Redundant)

### Documentation Files (Redundant - info in PROJECT_INSTRUCTIONS.md and CURRENT_STATE.md)

**Safe to delete:**
- `ADMIN_PANEL_COMPLETE.md` - Covered in PROJECT_INSTRUCTIONS.md
- `ADMIN_PANEL_SETUP.md` - Covered in PROJECT_INSTRUCTIONS.md
- `ALBUMS_FEATURE_SUMMARY.md` - Covered in PROJECT_INSTRUCTIONS.md
- `CURRENT_STATUS.md` - Redundant with CURRENT_STATE.md
- `DEBUG_SEARCH_ISSUE.md` - Historical debug doc, no longer needed
- `DEPLOYMENT_NOTES_PHOTOS.md` - Covered in DEPLOYMENT_GUIDE.md
- `GET_SERVICE_KEY.md` - Covered in DEPLOYMENT_GUIDE.md
- `GITHUB_DEPLOYMENT_QUICKSTART.md` - Covered in DEPLOYMENT_GUIDE.md
- `MIGRATION_COMPLETE.md` - Historical, covered in PROJECT_INSTRUCTIONS.md
- `MOBILE_RESPONSIVE_IMPROVEMENTS.md` - Covered in PROJECT_INSTRUCTIONS.md
- `NEXT_STEPS.md` - Outdated, covered in CURRENT_STATE.md
- `NOTES_PHOTOS_FEATURE.md` - Covered in PROJECT_INSTRUCTIONS.md
- `PERSISTENT_SESSION_FIX.md` - Historical fix doc, no longer needed
- `PRE_DEPLOYMENT_CHECKLIST.md` - Covered in DEPLOYMENT_GUIDE.md
- `PROJECT_PLAN.md` - Outdated, covered in PROJECT_INSTRUCTIONS.md
- `PROJECT_SUMMARY.md` - Redundant with PROJECT_INSTRUCTIONS.md
- `QUICK_START.md` - Covered in README.md
- `QUICK_START_ADMIN.md` - Covered in PROJECT_INSTRUCTIONS.md
- `QUICK_START_SETLISTFM_IMPORT.md` - Covered in PROJECT_INSTRUCTIONS.md
- `SECURITY_VERIFICATION.md` - Historical verification, covered in PROJECT_INSTRUCTIONS.md
- `SETLIST_EDITOR_COMPLETE.md` - Covered in PROJECT_INSTRUCTIONS.md
- `SETLIST_EDITOR_GUIDE.md` - Covered in PROJECT_INSTRUCTIONS.md
- `SETLIST_FM_API_INTEGRATION.md` - Covered in PROJECT_INSTRUCTIONS.md
- `SETLIST_FM_INTEGRATION_SUMMARY.md` - Covered in PROJECT_INSTRUCTIONS.md
- `SETUP_GUIDE.md` - Covered in README.md and DEPLOYMENT_GUIDE.md
- `SHOW_DETAIL_FEATURE.md` - Covered in PROJECT_INSTRUCTIONS.md
- `STATS_PAGE_PERFORMANCE_FIX.md` - Historical fix doc, no longer needed
- `TAILWIND_V4_SETUP.md` - Covered in README.md
- `TIMEZONE_FIX.md` - Historical fix doc, no longer needed

**Keep these core docs:**
- `README.md` - Main project documentation
- `PROJECT_INSTRUCTIONS.md` - Critical lessons and architecture
- `CURRENT_STATE.md` - Current status and next steps
- `DEPLOYMENT_GUIDE.md` - Deployment instructions

### Root-Level Scripts (Should be in scripts/ folder)

**Move to scripts/ or delete:**
- `audit_orphaned_data.js` → Move to `scripts/audit_orphaned_data.js`
- `check_empty_shows.js` → Move to `scripts/check_empty_shows.js` (duplicate exists)
- `debug_setlist_songs.js` → Move to `scripts/debug_setlist_songs.js`
- `test_stats_performance.js` → Move to `scripts/test_stats_performance.js`

### Template Files (No longer needed - app is built)

**Safe to delete:**
- `client-templates/` - Entire directory (templates were used during initial setup)

### Unused Scripts (Historical/One-time use)

**Safe to delete:**
- `scripts/check_affected_shows.js` - One-time migration script
- `scripts/check_sept_2025_shows.js` - One-time debug script
- `scripts/cleanup_combined_songs.js` - One-time migration script
- `scripts/find_combined_songs.js` - One-time migration script
- `scripts/fix_two_affected_shows.js` - One-time fix script
- `scripts/reimport_affected_shows.js` - One-time migration script
- `scripts/restore_sept16_show.js` - One-time restore script (duplicate of restore_sept16_2025_setlist.js)
- `scripts/restore_sept17_setlist.sql` - One-time SQL script
- `scripts/run_albums_migration.js` - One-time migration script
- `scripts/run_jams_into_migration.js` - One-time migration script
- `scripts/sample_empty_shows.js` - Debug script, no longer needed

**Keep these useful scripts:**
- `scripts/check_show_setlist.js` - Useful for debugging
- `scripts/check_song_references.js` - Useful before deleting songs
- `scripts/find_empty_shows.js` - Useful for data quality checks
- `scripts/find_missing_show.js` - Useful for debugging
- `scripts/find_unplayed_songs.js` - Useful for data analysis
- `scripts/import_from_setlistfm.py` - Active import script
- `scripts/restore_sept16_2025_setlist.js` - Keep as reference for future restores
- `scripts/restore_single_show.py` - Useful for future restores
- `scripts/verify_database_state.js` - Useful for data quality checks
- `scripts/debug_song_stats.js` - Useful for debugging

### Database Files (Historical)

**Safe to delete:**
- `database/debug_missing_tags.sql` - One-time debug script
- `database/fix_null_is_original.sql` - One-time fix script
- `database/migration_add_jams_into.sql` - Historical migration (completed)
- `database/migration_remove_setlist_songs_metadata.sql` - Historical migration (completed)
- `database/migration_setlistfm_compatibility.sql` - Historical migration (completed)
- `database/migration_user_notes_photos.sql` - Historical migration (completed)
- `database/migration_user_posters.sql` - Historical migration (completed)
- `database/verify_migration_success.sql` - One-time verification script

**Keep these:**
- `database/schema.sql` - Core schema definition
- `database/seed_sample_data.sql` - Useful for testing

### SQL Scripts in scripts/ folder

**Safe to delete:**
- `scripts/check_columns.sql` - One-time debug script
- `scripts/cleanup_setlist_songs.sql` - One-time cleanup script

---

## 🔧 Additional Hardening Recommendations

### 1. Add Error Boundaries
- Wrap main app components in React Error Boundaries
- Prevent full app crashes from component errors

### 2. Improve API Error Handling
- Add retry logic for failed API calls
- Better error messages for users
- Graceful degradation when backend is unavailable

### 3. Add Session Recovery
- Detect when session is corrupted
- Offer "Refresh Session" button
- Auto-clear corrupted sessions

### 4. Add Loading States
- Show loading indicators for all async operations
- Prevent multiple simultaneous requests
- Disable buttons during operations

### 5. Add Request Timeouts
- Set timeouts for all API calls
- Prevent hanging requests
- Show timeout errors to users

---

## 📊 Summary

**Files to Delete:** ~50+ redundant documentation and historical files  
**Files to Move:** 4 root-level scripts to scripts/ folder  
**Files to Keep:** Core documentation, active scripts, schema files

**Benefits:**
- Cleaner repository
- Easier to navigate
- Less confusion about which docs are current
- Faster onboarding for new developers

