# Session Management Fixes

**Date:** November 12, 2025  
**Issue:** Users experiencing "zombie sessions" where they appear logged in but API calls fail, dropdowns don't populate, and links don't work after a period of inactivity.

---

## 🔍 Root Cause Analysis

### Problem 1: Stale Tokens
The `getAuthToken()` function was synchronous and relied on a token getter function passed from AuthContext. This meant tokens could become stale between when they were retrieved and when API calls were made.

### Problem 2: Insufficient Refresh Frequency
Session refresh was happening every 30 minutes, but Supabase tokens expire after 1 hour. If a user was inactive for 30-60 minutes, the token could expire before the next refresh.

### Problem 3: No Error Recovery
When API calls failed with 401 (Unauthorized) due to expired tokens, there was no mechanism to:
- Detect the expiration
- Refresh the session automatically
- Retry the failed request
- Alert the user to re-authenticate

### Problem 4: No Proactive Expiry Detection
The app didn't check if tokens were about to expire and refresh them proactively.

---

## ✅ Implemented Fixes

### Fix 1: Async Token Retrieval with Fresh Sessions
**File:** `client/src/services/api.js`

**Before:**
```javascript
let authTokenGetter = null;

export const setAuthTokenGetter = (getter) => {
    authTokenGetter = getter;
};

const getAuthToken = () => {
    if (!authTokenGetter) {
        console.warn('[API] getAuthToken: No auth token getter set');
        return null;
    }
    const token = authTokenGetter();
    console.log('[API] getAuthToken:', token ? 'Token found' : 'No token');
    return token;
};
```

**After:**
```javascript
const getAuthToken = async () => {
    try {
        console.log('[API] getAuthToken: Fetching fresh session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('[API] getAuthToken: Error getting session:', error);
            return null;
        }
        
        if (!session) {
            console.warn('[API] getAuthToken: No active session');
            return null;
        }
        
        console.log('[API] getAuthToken: Token found, expires at:', new Date(session.expires_at * 1000).toLocaleString());
        return session.access_token;
    } catch (error) {
        console.error('[API] getAuthToken: Exception:', error);
        return null;
    }
};
```

**Benefits:**
- ✅ Always fetches a fresh token from Supabase
- ✅ Logs token expiry time for debugging
- ✅ Eliminates stale token issues

---

### Fix 2: 401 Error Interceptor with Automatic Retry
**File:** `client/src/services/api.js`

**Added:**
```javascript
const fetchWithAuth = async (url, options = {}) => {
    // First attempt
    let response = await fetch(url, options);
    
    // If we get a 401, try to refresh the session and retry once
    if (response.status === 401) {
        console.log('[API] fetchWithAuth: Got 401, attempting to refresh session...');
        
        try {
            const { data: { session }, error } = await supabase.auth.refreshSession();
            
            if (error || !session) {
                console.error('[API] fetchWithAuth: Session refresh failed:', error);
                throw new Error('Session expired. Please log in again.');
            }
            
            console.log('[API] fetchWithAuth: Session refreshed, retrying request...');
            
            // Update the Authorization header with the new token
            if (options.headers && options.headers.Authorization) {
                options.headers.Authorization = `Bearer ${session.access_token}`;
            }
            
            // Retry the request with the new token
            response = await fetch(url, options);
            
            if (response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
            }
        } catch (error) {
            console.error('[API] fetchWithAuth: Error during retry:', error);
            throw error;
        }
    }
    
    return response;
};
```

**Updated:** All authenticated API calls now use `fetchWithAuth` instead of `fetch`:
- `markShowAttended`
- `unmarkShowAttended`
- `checkShowAttendanceBatch`
- `checkShowAttendance`
- `getUserStats`
- `getAttendedShows`
- `getUserNote`
- `saveNote`
- `deleteNote`
- `uploadPhoto`
- `updatePhotoCaption`
- `deletePhoto`
- `uploadPoster`
- `updatePosterCaption`
- `deletePoster`

**Benefits:**
- ✅ Automatically detects 401 errors
- ✅ Refreshes session on authentication failure
- ✅ Retries failed requests with new token
- ✅ Provides clear error messages to users

---

### Fix 3: Reduced Refresh Interval
**File:** `client/src/contexts/AuthContext.jsx`

**Before:**
```javascript
const refreshInterval = setInterval(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        console.log('[AuthContext] Refreshing session...');
        const { error } = await supabase.auth.refreshSession();
        if (error) {
            console.error('[AuthContext] Error refreshing session:', error);
        } else {
            console.log('[AuthContext] Session refreshed successfully');
        }
    }
}, 30 * 60 * 1000); // 30 minutes
```

**After:**
```javascript
const refreshInterval = setInterval(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // Check if token is expiring soon (within 5 minutes)
        const expiresAt = session.expires_at * 1000;
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        const fiveMinutes = 5 * 60 * 1000;

        if (timeUntilExpiry < fiveMinutes) {
            console.log('[AuthContext] Token expiring soon, refreshing immediately...');
        } else {
            console.log('[AuthContext] Proactive session refresh...');
        }

        const { error } = await supabase.auth.refreshSession();
        if (error) {
            console.error('[AuthContext] Error refreshing session:', error);
        } else {
            console.log('[AuthContext] Session refreshed successfully');
        }
    }
}, 15 * 60 * 1000); // 15 minutes
```

**Benefits:**
- ✅ Refreshes every 15 minutes instead of 30
- ✅ Checks token expiry time before refreshing
- ✅ Provides better logging for debugging

---

### Fix 4: Proactive Session Expiry Detection
**File:** `client/src/contexts/AuthContext.jsx`

**Added:**
```javascript
// Additional check every 5 minutes to catch expiring tokens early
const expiryCheckInterval = setInterval(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const expiresAt = session.expires_at * 1000;
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        const tenMinutes = 10 * 60 * 1000;

        // If token expires in less than 10 minutes, refresh it now
        if (timeUntilExpiry < tenMinutes) {
            console.log('[AuthContext] Token expiring in', Math.floor(timeUntilExpiry / 60000), 'minutes, refreshing now...');
            const { error } = await supabase.auth.refreshSession();
            if (error) {
                console.error('[AuthContext] Error refreshing session:', error);
            } else {
                console.log('[AuthContext] Session refreshed successfully');
            }
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes
```

**Cleanup:**
```javascript
return () => {
    subscription.unsubscribe();
    clearInterval(refreshInterval);
    clearInterval(expiryCheckInterval);
};
```

**Benefits:**
- ✅ Checks every 5 minutes for expiring tokens
- ✅ Refreshes tokens that expire within 10 minutes
- ✅ Prevents token expiration during active sessions
- ✅ Provides detailed logging of time until expiry

---

### Fix 5: Removed Deprecated Token Getter Pattern
**File:** `client/src/App.jsx`

**Removed:**
```javascript
import { setAuthTokenGetter } from './services/api'

// ...

useEffect(() => {
    if (getToken) {
        setAuthTokenGetter(getToken);
    }
}, [getToken]);
```

**Benefits:**
- ✅ Simplified code
- ✅ Removed unnecessary dependency on AuthContext
- ✅ Tokens now fetched directly from Supabase

---

## 📊 Summary of Changes

### Files Modified
1. **`client/src/services/api.js`**
   - Made `getAuthToken()` async and fetch fresh tokens
   - Added `fetchWithAuth()` wrapper for 401 error handling
   - Updated 15 authenticated API functions to use `fetchWithAuth`

2. **`client/src/contexts/AuthContext.jsx`**
   - Reduced refresh interval from 30 to 15 minutes
   - Added expiry time checking to refresh interval
   - Added separate 5-minute expiry check interval
   - Enhanced logging for debugging

3. **`client/src/App.jsx`**
   - Removed `setAuthTokenGetter` import and usage
   - Removed `getToken` from useAuth destructuring
   - Removed useEffect that set up token getter

---

## 🎯 Expected Behavior After Fixes

### Before
- ❌ Sessions would appear active but API calls would fail
- ❌ Dropdowns wouldn't populate after inactivity
- ❌ Links wouldn't work after 30-60 minutes
- ❌ No automatic recovery from expired tokens
- ❌ Users had to manually refresh or re-login

### After
- ✅ Fresh tokens fetched for every API call
- ✅ Automatic session refresh every 15 minutes
- ✅ Proactive refresh when tokens expire within 10 minutes
- ✅ Automatic retry of failed requests after 401 errors
- ✅ Clear error messages when re-authentication is needed
- ✅ Comprehensive logging for debugging session issues

---

## 🧪 Testing Recommendations

1. **Test Normal Usage**
   - Log in and use the app normally
   - Verify all features work as expected

2. **Test Inactivity**
   - Log in and leave the app idle for 20 minutes
   - Return and try to use features (mark attendance, add notes, etc.)
   - Verify features work without re-login

3. **Test Extended Inactivity**
   - Log in and leave the app idle for 65 minutes (past token expiry)
   - Return and try to use features
   - Verify automatic session refresh and retry works

4. **Test Console Logs**
   - Open browser console
   - Watch for session refresh logs every 15 minutes
   - Watch for expiry check logs every 5 minutes
   - Verify token expiry times are logged correctly

5. **Test Error Handling**
   - Manually clear localStorage to simulate expired session
   - Try to use authenticated features
   - Verify clear error message appears

---

## 📝 Notes

- Supabase tokens expire after **1 hour** by default
- Session refresh now happens every **15 minutes**
- Expiry checks happen every **5 minutes**
- Tokens are refreshed proactively if expiring within **10 minutes**
- All authenticated API calls now have automatic retry on 401 errors
- Console logs provide detailed debugging information

---

## 🔗 Related Documentation

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Session Management](https://supabase.com/docs/guides/auth/sessions)
- `HARDENING_SUMMARY.md` - Previous session management improvements

