// The slice of the API layer the initial page load needs. Kept out of api.js
// so the bundler can leave api.js and its ~100 other functions out of the
// main bundle; api.js re-exports everything here, so its importers are unchanged.
import { supabase } from './supabase';
import { trackEvent } from '../utils/analytics';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Log the API URL for debugging
console.log('[API Service] Using API Base URL:', API_BASE_URL);

// Token getter function - will be set by AuthContext
let tokenGetter = null;

export const setTokenGetter = (getter) => {
    console.log('[API] setTokenGetter called');
    tokenGetter = getter;
};

/**
 * Get authentication token
 * Uses the token getter provided by AuthContext for immediate access
 * Falls back to Supabase session if token getter is not available
 */
export const getAuthToken = async () => {
    try {
        // First try to use the token getter from AuthContext (fastest)
        if (tokenGetter) {
            console.log('[API] getAuthToken: Using token getter from AuthContext');
            const token = await tokenGetter(); // Now async!
            if (token) {
                console.log('[API] getAuthToken: Token found from AuthContext');
                return token;
            }
            console.log('[API] getAuthToken: No token from AuthContext, falling back to Supabase');
        }

        // Fallback to Supabase session (slower but more reliable)
        console.log('[API] getAuthToken: Fetching fresh session from Supabase...');

        // Add timeout to prevent hanging on getSession
        const timeoutMs = 10000; // 10 seconds
        let timeoutId;

        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                console.error('[API] getAuthToken: Timeout after', timeoutMs, 'ms');
                reject(new Error('getSession timeout'));
            }, timeoutMs);
        });

        const result = await Promise.race([sessionPromise, timeoutPromise]);
        clearTimeout(timeoutId);

        console.log('[API] getAuthToken: Session fetch completed');

        const { data: { session }, error } = result;

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

/**
 * Wrapper for fetch that handles 401 errors by refreshing the session and retrying
 */
export const fetchWithAuth = async (url, options = {}) => {
    // First attempt
    let response = await fetch(url, options);

    // If we get a 401, try to refresh the session and retry once
    if (response.status === 401) {
        console.log('[API] fetchWithAuth: Got 401, attempting to refresh session...');

        try {
            const { data: { session }, error } = await supabase.auth.refreshSession();

            if (error || !session) {
                console.error('[API] fetchWithAuth: Session refresh failed:', error);
                // Session is truly expired, user needs to log in again
                throw new Error('Session expired. Please log in again.');
            }

            console.log('[API] fetchWithAuth: Session refreshed, retrying request...');

            // Create new options with updated token, preserving all other options
            const retryOptions = {
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${session.access_token}`
                }
            };

            // Retry the request with the new token
            response = await fetch(url, retryOptions);

            if (response.status === 401) {
                // Still getting 401 after refresh, session is invalid
                throw new Error('Authentication failed. Please log in again.');
            }
        } catch (error) {
            console.error('[API] fetchWithAuth: Error during retry:', error);
            throw error;
        }
    }

    return response;
};

/**
 * Search for shows with filters
 */
export const searchShows = async (filters = {}) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            params.append(key, value);
        }
    });

    const response = await fetch(`${API_BASE_URL}/api/search/shows?${params}`);
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        console.error('[searchShows] API error:', body);
        throw new Error(body.detail || body.error || 'Failed to search shows');
    }
    return response.json();
};

/**
 * Same as getShowDebuts, batched for list views — one call instead of one per row.
 * Returns { [show_id]: { live_debut_song_ids, tour_debut_song_ids } }. Server caps a
 * single batch at 500 show_ids; chunk on the caller's side for anything larger.
 */
export const getShowDebutsBatch = async (showIds) => {
    if (!showIds?.length) return {};
    const response = await fetch(`${API_BASE_URL}/api/shows/debuts-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_ids: showIds }),
    });
    if (!response.ok) throw new Error('Failed to fetch debuts batch');
    return response.json();
};

export const getBands = async () => {
    const response = await fetch(`${API_BASE_URL}/api/bands`);
    if (!response.ok) throw new Error('Failed to fetch bands');
    return response.json();
};

/**
 * Mark a show as attended
 */
export const markShowAttended = async (showId) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/attended-shows/${showId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark show as attended');
    }
    trackEvent('mark_show_attended');
    return response.json();
};

/**
 * Unmark a show as attended
 */
export const unmarkShowAttended = async (showId) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/attended-shows/${showId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to unmark show');
    }
    return response.json();
};

/**
 * Check attendance for multiple shows at once (batch)
 */
export const checkShowAttendanceBatch = async (showIds) => {
    const token = await getAuthToken();
    if (!token || !showIds || showIds.length === 0) {
        return {};
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/check-attendance-batch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ showIds }),
        });

        if (!response.ok) {
            console.error('Failed to check attendance batch');
            return {};
        }

        const data = await response.json();
        return data.attendance || {};
    } catch (error) {
        console.error('Error checking attendance batch:', error);
        return {};
    }
};

/**
 * Check if shows have notes or photos (batch check for search results)
 */
export const checkShowsHaveContent = async (showIds) => {
    console.log('[API] checkShowsHaveContent: Checking content for shows:', showIds);

    if (!showIds || showIds.length === 0) {
        return { contentMap: {} };
    }

    const response = await fetch(`${API_BASE_URL}/api/notes/check-content`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ show_ids: showIds }),
    });

    if (!response.ok) {
        console.error('[API] checkShowsHaveContent: Failed to check content');
        throw new Error('Failed to check content');
    }

    const data = await response.json();
    console.log('[API] checkShowsHaveContent: Content map:', data.contentMap);
    return data;
};

/**
 * Site-wide editable text — currently the header title/subtitle shown on
 * every page. Public, no auth required.
 */
export const getSiteSettings = async () => {
    const response = await fetch(`${API_BASE_URL}/api/settings`);
    if (!response.ok) {
        throw new Error('Failed to fetch site settings');
    }
    return response.json();
};
