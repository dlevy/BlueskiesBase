// API service for making calls to the backend
import { supabase } from './supabase';
import { trackEvent } from '../utils/analytics';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Log the API URL for debugging
console.log('[API Service] Using API Base URL:', API_BASE_URL);

// Token getter function - will be set by AuthContext
let tokenGetter = null;

export const setTokenGetter = (getter) => {
    console.log('[API] setTokenGetter called');
    tokenGetter = getter;
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
 * Get all shows with pagination. Optionally restrict to a show_date range
 * (inclusive) via dateFrom/dateTo (YYYY-MM-DD).
 */
export const getShows = async (page = 1, limit = 20, { dateFrom, dateTo } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const response = await fetch(`${API_BASE_URL}/api/shows?${params}`);
    if (!response.ok) {
        throw new Error('Failed to fetch shows');
    }
    return response.json();
};

/**
 * Get a single show by ID with full setlist
 */
export const getShowById = async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/shows/${id}`);
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        console.error('[getShowById] API error:', body);
        throw new Error(body.detail || body.error || 'Failed to fetch show');
    }
    return response.json();
};

/**
 * Get the previous and next show by date
 */
export const getAdjacentShows = async (showId) => {
    const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/adjacent`);
    if (!response.ok) throw new Error('Failed to fetch adjacent shows');
    return response.json();
};

/**
 * Get tour-level song play counts for the show's tour
 */
export const getTourRarity = async (showId) => {
    const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/tour-rarity`);
    if (!response.ok) throw new Error('Failed to fetch tour rarity');
    return response.json();
};

/**
 * Members who marked this show as attended (usernames only).
 */
export const getShowAttendees = async (showId) => {
    const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/attendees`);
    if (!response.ok) throw new Error('Failed to fetch attendees');
    return response.json();
};


/**
 * Which songs in a show's setlist were live debuts / tour debuts.
 */
export const getShowDebuts = async (showId) => {
    const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/debuts`);
    if (!response.ok) throw new Error('Failed to fetch debuts');
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

/**
 * Look up a show by URL slugs (date, artist, location), then fetch full details
 */
export const getShowBySlug = async (date, artist, location) => {
    const params = new URLSearchParams({ date, artist, location });
    const lookupRes = await fetch(`${API_BASE_URL}/api/shows/lookup?${params}`);
    if (!lookupRes.ok) {
        const body = await lookupRes.json().catch(() => ({}));
        throw new Error(body.error || 'Show not found');
    }
    const { id } = await lookupRes.json();
    return getShowById(id);
};

/**
 * Get all songs
 */
export const getSongs = async () => {
    const response = await fetch(`${API_BASE_URL}/api/songs`);
    if (!response.ok) {
        throw new Error('Failed to fetch songs');
    }
    return response.json();
};

/**
 * Get a single song by ID with performance history
 */
export const getSongById = async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/songs/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch song');
    }
    return response.json();
};

/**
 * Get global song statistics (covers and originals)
 */
export const getGlobalSongStats = async ({ startDate, endDate, tour } = {}) => {
    const params = new URLSearchParams();
    if (tour) params.set('tour', tour);
    else {
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
    }
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/api/songs/stats/global${query ? `?${query}` : ''}`);
    if (!response.ok) {
        throw new Error('Failed to fetch song statistics');
    }
    return response.json();
};

/**
 * Get site-wide community stats (members, photos, posters contributed)
 */
export const getCommunityStats = async () => {
    const response = await fetch(`${API_BASE_URL}/api/users/community-stats`);
    if (!response.ok) {
        throw new Error('Failed to fetch community statistics');
    }
    return response.json();
};

/**
 * Create a new song
 */
export const createSong = async (songData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/songs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(songData)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create song');
    }
    return response.json();
};

/**
 * Update an existing song
 */
export const updateSong = async (id, songData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/songs/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(songData)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update song');
    }
    return response.json();
};

/**
 * Delete a song
 */
export const deleteSong = async (id) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/songs/${id}`, {
        method: 'DELETE',
        headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete song');
    }
    return response.json();
};

/**
 * Get all albums
 */
export const getAlbums = async () => {
    const response = await fetch(`${API_BASE_URL}/api/albums`);
    if (!response.ok) {
        throw new Error('Failed to fetch albums');
    }
    return response.json();
};

/**
 * Get a single album by ID with songs
 */
export const getAlbumById = async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/albums/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch album');
    }
    return response.json();
};

/**
 * Create a new album
 */
export const createAlbum = async (albumData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/albums`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(albumData)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create album');
    }
    return response.json();
};

/**
 * Update an existing album
 */
export const updateAlbum = async (id, albumData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/albums/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(albumData)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update album');
    }
    return response.json();
};

/**
 * Delete an album
 */
export const deleteAlbum = async (id) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/albums/${id}`, {
        method: 'DELETE',
        headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete album');
    }
    return response.json();
};

/**
 * Get songs for an album (ordered by track_order)
 */
export const getAlbumSongs = async (albumId) => {
    const response = await fetch(`${API_BASE_URL}/api/albums/${albumId}/songs`);
    if (!response.ok) throw new Error('Failed to fetch album songs');
    return response.json();
};

/**
 * Add a song to an album
 */
export const addSongToAlbum = async (albumId, songId, trackOrder) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/albums/${albumId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ song_id: songId, track_order: trackOrder }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to add song to album');
    }
    return response.json();
};

/**
 * Remove a song from an album
 */
export const removeSongFromAlbum = async (albumId, songId) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/albums/${albumId}/songs/${songId}`, {
        method: 'DELETE',
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) throw new Error('Failed to remove song from album');
    return response.json();
};

/**
 * Save track order for songs in an album
 * songs: [{ song_id, track_order }]
 */
export const reorderAlbumSongs = async (albumId, songs) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/albums/${albumId}/songs/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ songs }),
    });
    if (!response.ok) throw new Error('Failed to reorder album songs');
    return response.json();
};

// ============================================
// LINKS API
// ============================================

/**
 * Get all links (each with its category embedded)
 */
export const getLinks = async () => {
    const response = await fetch(`${API_BASE_URL}/api/links`);
    if (!response.ok) {
        throw new Error('Failed to fetch links');
    }
    return response.json();
};

/**
 * Create a new link
 */
export const createLink = async (linkData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/links`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(linkData)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create link');
    }
    return response.json();
};

/**
 * Update an existing link
 */
export const updateLink = async (id, linkData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/links/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(linkData)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update link');
    }
    return response.json();
};

/**
 * Delete a link
 */
export const deleteLink = async (id) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/links/${id}`, {
        method: 'DELETE',
        headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete link');
    }
    return response.json();
};

/**
 * Get all link categories, in display order
 */
export const getLinkCategories = async () => {
    const response = await fetch(`${API_BASE_URL}/api/links/categories`);
    if (!response.ok) {
        throw new Error('Failed to fetch link categories');
    }
    return response.json();
};

/**
 * Create a new link category
 */
export const createLinkCategory = async (name) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/links/categories`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ name })
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create category');
    }
    return response.json();
};

/**
 * Update a link category's name and/or sort_order
 */
export const updateLinkCategory = async (id, data) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/links/categories/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update category');
    }
    return response.json();
};

/**
 * Delete a link category
 */
export const deleteLinkCategory = async (id) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/links/categories/${id}`, {
        method: 'DELETE',
        headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete category');
    }
    return response.json();
};

/**
 * Get all venues
 */
export const getVenues = async () => {
    const response = await fetch(`${API_BASE_URL}/api/venues`);
    if (!response.ok) {
        throw new Error('Failed to fetch venues');
    }
    return response.json();
};

/**
 * Get a single venue by ID with all shows
 */
export const getVenueById = async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/venues/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch venue');
    }
    return response.json();
};

/**
 * Create a new venue
 */
export const createVenue = async (venueData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/venues`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(venueData),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create venue');
    }
    return response.json();
};

/**
 * Update an existing venue
 */
export const updateVenue = async (id, venueData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/venues/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(venueData),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update venue');
    }
    return response.json();
};

/**
 * Delete a venue
 */
export const deleteVenue = async (id) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/venues/${id}`, {
        method: 'DELETE',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete venue');
    }
    return response.json();
};

/**
 * Search for songs
 */
export const searchSongs = async (filters = {}) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            params.append(key, value);
        }
    });

    const response = await fetch(`${API_BASE_URL}/api/search/songs?${params}`);
    if (!response.ok) {
        throw new Error('Failed to search songs');
    }
    return response.json();
};

// ============================================
// BANDS API
// ============================================

export const getBands = async () => {
    const response = await fetch(`${API_BASE_URL}/api/bands`);
    if (!response.ok) throw new Error('Failed to fetch bands');
    return response.json();
};

export const createBand = async (name) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/bands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create band');
    }
    return response.json();
};

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Create a new show
 */
export const createShow = async (showData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/shows`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(showData),
    });
    if (!response.ok) {
        throw new Error('Failed to create show');
    }
    return response.json();
};

/**
 * Update a show
 */
export const updateShow = async (id, showData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/shows/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(showData),
    });
    if (!response.ok) {
        throw new Error('Failed to update show');
    }
    return response.json();
};

/**
 * Add or remove a show's tour assignment only — leaves every other field
 * untouched (see the PATCH handler's docstring for why this is separate
 * from updateShow).
 */
export const updateShowTour = async (id, tourName) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/shows/${id}/tour`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ tour_name: tourName || null }),
    });
    if (!response.ok) {
        throw new Error('Failed to update show tour');
    }
    return response.json();
};

/**
 * Delete a show
 */
export const deleteShow = async (id) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/shows/${id}`, {
        method: 'DELETE',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });
    if (!response.ok) {
        throw new Error('Failed to delete show');
    }
    return response.json();
};

/**
 * Update the entire setlist for a show
 */
export const updateSetlist = async (showId, setlist) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/setlist`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ setlist }),
    });
    if (!response.ok) {
        throw new Error('Failed to update setlist');
    }
    return response.json();
};

/**
 * Add a song to a show's setlist
 */
export const addSongToSetlist = async (showId, songData) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/setlist/song`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(songData),
    });
    if (!response.ok) {
        throw new Error('Failed to add song to setlist');
    }
    return response.json();
};

/**
 * Remove a song from a show's setlist
 */
export const removeSongFromSetlist = async (showId, setlistId) => {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/setlist/${setlistId}`, {
        method: 'DELETE',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });
    if (!response.ok) {
        throw new Error('Failed to remove song from setlist');
    }
    return response.json();
};

// ============================================
// USER FUNCTIONS
// ============================================

/**
 * Get authentication token
 * Uses the token getter provided by AuthContext for immediate access
 * Falls back to Supabase session if token getter is not available
 */
const getAuthToken = async () => {
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
 * Check if a show is marked as attended
 */
export const checkShowAttendance = async (showId) => {
    const token = await getAuthToken();
    if (!token) {
        return { attended: false };
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/check-attendance/${showId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to check attendance');
    }
    return response.json();
};

/**
 * Get user statistics
 */
export const getUserStats = async () => {
    console.log('[API] getUserStats: Starting...');

    const token = await getAuthToken();
    if (!token) {
        console.log('[API] getUserStats: No auth token');
        throw new Error('Not authenticated');
    }

    console.log('[API] getUserStats: Fetching from backend...');

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API] getUserStats: Error response:', response.status, errorText);
            throw new Error(`Failed to fetch user statistics: ${response.status}`);
        }

        console.log('[API] getUserStats: Parsing response...');
        const data = await response.json();
        console.log('[API] getUserStats: Success');
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('[API] getUserStats: Request timeout');
            throw new Error('Request timed out. Please try again.');
        }
        console.error('[API] getUserStats: Error:', error);
        throw error;
    }
};

/**
 * Every registered member, for the member directory. Requires the viewer to
 * be signed in — not visible to anonymous visitors.
 */
export const getMemberDirectory = async () => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/directory`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch member directory');
    }
    return response.json();
};

/**
 * Lightweight username/display-name list for @mention autocomplete.
 */
export const getMentionableUsers = async () => {
    const token = await getAuthToken();
    if (!token) return { users: [] };

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/mentionable`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch mentionable users');
    }
    return response.json();
};

/**
 * Every member who has added at least one social link (Facebook/Reddit/
 * Instagram/YouTube) to their profile. Public, no auth required — used by the
 * "Member Links" section on /links.
 */
export const getMemberSocialLinks = async () => {
    const response = await fetch(`${API_BASE_URL}/api/users/social-links`);
    if (!response.ok) {
        throw new Error('Failed to fetch member links');
    }
    return response.json();
};

/**
 * Public profile for a given username. Returns null (not throw) on a 404 so
 * callers can render a "not found" state without a try/catch.
 */
export const getPublicProfile = async (username) => {
    const response = await fetch(`${API_BASE_URL}/api/users/profile/${encodeURIComponent(username)}`);
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch profile');
    }
    return response.json();
};

/**
 * Update the logged-in user's own opt-in profile fields.
 */
export const updateMyProfile = async (updates) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update profile');
    }
    return response.json();
};

/**
 * Upload/replace the logged-in user's avatar.
 */
export const uploadAvatar = async (file) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/avatar`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to upload avatar');
    }
    return response.json();
};

/**
 * Get all attended shows
 */
export const getAttendedShows = async () => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/attended-shows`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch attended shows');
    }
    return response.json();
};

// ============================================
// SETLIST SUBMISSIONS API (community setlist contributions)
// ============================================

/**
 * Get all community setlist submissions for a show
 */
export const getSetlistSubmissions = async (showId) => {
    const response = await fetch(`${API_BASE_URL}/api/setlist-submissions/show/${showId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch setlist submissions');
    }
    return response.json();
};

/**
 * Admin/editor review queue: every setlist submission across every show.
 */
export const getAllSetlistSubmissions = async () => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/setlist-submissions`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch setlist submissions');
    }
    return response.json();
};

/**
 * Get the current user's own setlist submission for a show
 */
export const getUserSetlistSubmission = async (showId) => {
    const token = await getAuthToken();
    if (!token) {
        return { submission: null };
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/setlist-submissions/user/${showId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch your setlist submission');
    }
    return response.json();
};

/**
 * Create or replace the current user's setlist submission for a show.
 * songs: [{ song_id, notes? }] in the order they were played (best guess).
 */
export const saveSetlistSubmission = async (showId, songs, note) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/setlist-submissions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ show_id: showId, songs, note }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save setlist submission');
    }
    trackEvent('setlist_submitted');
    return response.json();
};

/**
 * Delete a setlist submission (own, or any if admin)
 */
export const deleteSetlistSubmission = async (submissionId) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/setlist-submissions/${submissionId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to delete setlist submission');
    }
    return response.json();
};

/**
 * Admin only — pull one submitted song into the official setlist.
 * targetSet: 'set1' | 'set2' | 'set3' | 'encore'
 */
export const mergeSetlistSubmissionSong = async (songRowId, targetSet) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/setlist-submissions/songs/${songRowId}/merge`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_set: targetSet }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to merge song into the official setlist');
    }
    return response.json();
};

/**
 * Accept every not-yet-merged song in a submission at once.
 * targets: { [songRowId]: 'set1' | 'set2' | 'set3' | 'encore' } — same shape
 * as the per-song merge dropdowns; a row with no entry defaults to 'set1'.
 */
export const mergeAllSetlistSubmissionSongs = async (submissionId, targets = {}) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/setlist-submissions/${submissionId}/merge-all`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targets }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to accept all songs into the official setlist');
    }
    return response.json();
};

// ============================================
// NOTES API
// ============================================

/**
 * Get all notes for a show
 */
export const getShowNotes = async (showId) => {
    const response = await fetch(`${API_BASE_URL}/api/notes/show/${showId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch notes');
    }
    return response.json();
};

/**
 * Add a new comment to a show. Users may post more than one.
 */
export const addNote = async (showId, noteText) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ show_id: showId, note_text: noteText }),
    });
    if (!response.ok) {
        throw new Error('Failed to save note');
    }
    return response.json();
};

/**
 * Edit one of your own comments
 */
export const updateNote = async (noteId, noteText) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/notes/${noteId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note_text: noteText }),
    });
    if (!response.ok) {
        throw new Error('Failed to update note');
    }
    return response.json();
};

/**
 * Delete a note
 */
export const deleteNote = async (noteId) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to delete note');
    }
    return response.json();
};

// ============================================
// PHOTOS API
// ============================================

/**
 * Every photo (for the Photos gallery page), newest show first.
 */
export const getAllPhotos = async () => {
    const response = await fetch(`${API_BASE_URL}/api/photos`);
    if (!response.ok) {
        throw new Error('Failed to fetch photos');
    }
    return response.json();
};

/**
 * Get all photos for a show
 */
export const getShowPhotos = async (showId) => {
    const response = await fetch(`${API_BASE_URL}/api/photos/show/${showId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch photos');
    }
    return response.json();
};

/**
 * Upload a photo
 */
export const uploadPhoto = async (showId, file, caption = '') => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('show_id', showId);
    if (caption) {
        formData.append('caption', caption);
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/photos/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload photo');
    }
    trackEvent('photo_uploaded');
    return response.json();
};

/**
 * Update photo caption
 */
export const updatePhotoCaption = async (photoId, caption) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/photos/${photoId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ caption }),
    });
    if (!response.ok) {
        throw new Error('Failed to update photo');
    }
    return response.json();
};

/**
 * Delete a photo
 */
export const deletePhoto = async (photoId) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/photos/${photoId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to delete photo');
    }
    return response.json();
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

// ============================================
// POSTERS API
// ============================================

/**
 * Every show poster (for the Posters gallery page), newest show first.
 */
export const getAllPosters = async () => {
    const response = await fetch(`${API_BASE_URL}/api/posters`);
    if (!response.ok) {
        throw new Error('Failed to fetch posters');
    }
    return response.json();
};

/**
 * Get poster for a show
 */
export const getShowPoster = async (showId) => {
    const response = await fetch(`${API_BASE_URL}/api/posters/show/${showId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch poster');
    }
    return response.json();
};

/**
 * Upload a poster (replaces the existing poster of the same variant, if any —
 * a show can have one regular and one foil poster, replaced independently).
 * If the existing poster is shared with other shows (a tour-leg poster, see
 * linkPosterToRange), the server refuses with a 409 unless
 * confirmSharedReplace is set — the thrown error then carries
 * `requiresConfirmation: true` and `sharedWithShowCount` so the caller can
 * confirm with the user and retry.
 */
export const uploadPoster = async (showId, file, caption = '', isFoil = false, confirmSharedReplace = false, additional = false, posterArtistName = '', posterArtistUrl = '') => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('poster', file);
    formData.append('show_id', showId);
    formData.append('is_foil', isFoil ? 'true' : 'false');
    if (caption) {
        formData.append('caption', caption);
    }
    if (confirmSharedReplace) {
        formData.append('confirm_shared_replace', 'true');
    }
    if (additional) {
        formData.append('additional', 'true');
    }
    if (posterArtistName) {
        formData.append('poster_artist_name', posterArtistName);
    }
    if (posterArtistUrl) {
        formData.append('poster_artist_url', posterArtistUrl);
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const error = new Error(errorBody.error || 'Failed to upload poster');
        if (errorBody.requiresConfirmation) {
            error.requiresConfirmation = true;
            error.sharedWithShowCount = errorBody.sharedWithShowCount;
        }
        throw error;
    }
    trackEvent('poster_uploaded');
    return response.json();
};

/**
 * Update a poster's caption and/or artist credit (posterArtistName/posterArtistUrl
 * are editor/admin-only server-side — see PUT /api/posters/:posterId).
 */
export const updatePosterDetails = async (posterId, { caption, posterArtistName, posterArtistUrl } = {}) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const body = {};
    if (caption !== undefined) body.caption = caption;
    if (posterArtistName !== undefined) body.posterArtistName = posterArtistName;
    if (posterArtistUrl !== undefined) body.posterArtistUrl = posterArtistUrl;

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/${posterId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error('Failed to update poster');
    }
    return response.json();
};

/**
 * Delete a poster
 */
export const deletePoster = async (posterId) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/${posterId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to delete poster');
    }
    return response.json();
};

/**
 * Every show currently linked to a poster (its full linked-shows set) — for
 * the "manage links" panel on a tour-leg poster. Editor/admin only.
 */
export const getPosterShows = async (posterId) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/${posterId}/shows`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to fetch linked shows');
    }
    return response.json();
};

/**
 * Link a poster to every show by the same artist within [startDate, endDate]
 * that doesn't already have a different poster of the same variant — e.g.
 * one poster used for a whole tour leg. Editor/admin only.
 */
export const linkPosterToRange = async (posterId, startDate, endDate) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/${posterId}/link-range`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ startDate, endDate }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to link poster to shows');
    }
    return response.json();
};

/**
 * Unlink one show from a poster without deleting the poster itself. Editor/admin only.
 */
export const unlinkPosterShow = async (posterId, showId) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/${posterId}/shows/${showId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to unlink show');
    }
    return response.json();
};

/**
 * The logged-in user's own poster collection (which posters they own, and
 * whether they have the foil variant of each).
 */
export const getMyPosterCollection = async () => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/collection`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch poster collection');
    return response.json();
};

/**
 * Add a poster to the logged-in user's collection. Whether it's the foil
 * variant is a property of the poster itself (which posterId you pass), not a
 * separate flag — the regular and foil editions are distinct poster rows.
 */
export const addToPosterCollection = async (posterId) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ posterId }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to add poster to collection');
    }
    return response.json();
};

/**
 * Remove a poster from the logged-in user's collection.
 */
export const removeFromPosterCollection = async (entryId) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/collection/${entryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to remove poster from collection');
    return response.json();
};

/**
 * List (or un-list) an owned poster as available for sale/trade. Owner only.
 */
export const updateCollectionTradeStatus = async (collectionId, { forTrade, tradeComment, editionType } = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const body = {};
    if (forTrade !== undefined) body.forTrade = forTrade;
    if (tradeComment !== undefined) body.tradeComment = tradeComment;
    if (editionType !== undefined) body.editionType = editionType;

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/collection/${collectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update');
    }
    return response.json();
};

/**
 * Every poster currently listed for sale/trade, across all members. Public.
 */
export const getPostersForTrade = async () => {
    const response = await fetch(`${API_BASE_URL}/api/posters/for-trade`);
    if (!response.ok) throw new Error('Failed to fetch for-trade posters');
    return response.json();
};

/**
 * Express interest in (or reply about) a for-trade listing — delivered as a
 * notification. Pass replyToUserId only when replying as the listing owner.
 */
export const sendPosterInterest = async (collectionId, message, replyToUserId = null) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const body = { message };
    if (replyToUserId) body.replyToUserId = replyToUserId;

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/collection/${collectionId}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to send message');
    }
    return response.json();
};

/**
 * The logged-in user's own wanted-posters list (shows they're looking to
 * acquire a poster for, independent of anything they already own).
 */
export const getMyPosterWants = async () => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/wants`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch poster wants');
    return response.json();
};

/**
 * Add a show to the logged-in user's wanted-posters list.
 * variant is 'any' | 'regular' | 'foil', defaults to 'any'.
 */
export const addPosterWant = async (showId, variant = 'any') => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/wants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ showId, variant }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to add to wanted list');
    }
    return response.json();
};

/**
 * Remove a show from the logged-in user's wanted-posters list.
 */
export const removePosterWant = async (wantId) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/posters/wants/${wantId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to remove from wanted list');
    return response.json();
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

/**
 * Update site-wide editable text. Admin only.
 * Body: { headerTitle?, headerSubtitle? }
 */
export const updateSiteSettings = async (updates) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/settings`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update site settings');
    }
    return response.json();
};

/**
 * Every thanks row relevant to a show's photos/posters/notes/setlist
 * submissions, in one request. Public, no auth required.
 */
export const getShowThanks = async (showId) => {
    const response = await fetch(`${API_BASE_URL}/api/thanks/show/${showId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch thanks');
    }
    return response.json();
};

/**
 * Thank a piece of content (photo/poster/note/setlist_submission).
 * Idempotent — thanking something already thanked is a harmless no-op.
 */
export const addThanks = async (contentType, contentId) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/thanks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ contentType, contentId }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save thanks');
    }
    return response.json();
};

/**
 * Un-thank a piece of content.
 */
export const removeThanks = async (contentType, contentId) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/thanks/${contentType}/${contentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to remove thanks');
    }
    return response.json();
};

/**
 * The logged-in user's own notifications (most recent first) plus a precise
 * unread count, for the header notification bell.
 */
export const getNotifications = async ({ includeDismissed = false, limit } = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const params = new URLSearchParams();
    if (includeDismissed) params.set('includeDismissed', 'true');
    if (limit) params.set('limit', String(limit));
    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await fetchWithAuth(`${API_BASE_URL}/api/notifications${query}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch notifications');
    }
    return response.json();
};

export const dismissNotification = async (notificationId) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/notifications/${notificationId}/dismiss`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to dismiss notification');
    }
    return response.json();
};

export const restoreNotification = async (notificationId) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/notifications/${notificationId}/restore`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to restore notification');
    }
    return response.json();
};

/**
 * Mark all of the logged-in user's unread notifications as read.
 */
export const markAllNotificationsRead = async () => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to mark notifications read');
    }
    return response.json();
};

// ============================================
// BAND MEMBERS & GEAR
// ============================================

export const getBandMembers = async () => {
    const response = await fetch(`${API_BASE_URL}/api/band-members`);
    if (!response.ok) throw new Error('Failed to fetch band members');
    return response.json();
};

export const getBandMember = async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/band-members/${id}`);
    if (!response.ok) throw new Error('Failed to fetch band member');
    return response.json();
};

export const createBandMember = async ({ name, bio, roles, links }) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/band-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, bio, roles, links }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create band member');
    }
    return response.json();
};

export const updateBandMember = async (id, { name, bio, roles, links, sort_order } = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/band-members/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, bio, roles, links, sort_order }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update band member');
    }
    return response.json();
};

export const deleteBandMember = async (id) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/band-members/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to delete band member');
    }
    return response.json();
};

export const uploadBandMemberPhoto = async (id, file) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('photo', file);

    const response = await fetchWithAuth(`${API_BASE_URL}/api/band-members/${id}/photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to upload photo');
    }
    return response.json();
};

/**
 * Replace all of a member's tenure rows in one call.
 * tenures: [{ start_date, end_date }, ...] — end_date null/omitted = currently active.
 */
export const replaceBandMemberTenures = async (id, tenures) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/band-members/${id}/tenures`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tenures }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save tenures');
    }
    return response.json();
};

/**
 * gear: { category, make?, model?, year?, notes?, start_date?, end_date?, photoFile? }
 */
const gearFormData = ({ category, make, model, year, notes, start_date, end_date, links, photoFile }) => {
    const formData = new FormData();
    formData.append('category', category);
    if (make) formData.append('make', make);
    if (model) formData.append('model', model);
    if (year) formData.append('year', year);
    if (notes) formData.append('notes', notes);
    if (start_date) formData.append('start_date', start_date);
    if (end_date) formData.append('end_date', end_date);
    if (links) formData.append('links', JSON.stringify(links));
    if (photoFile) formData.append('photo', photoFile);
    return formData;
};

export const createGearItem = async (bandMemberId, gear) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/band-members/${bandMemberId}/gear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: gearFormData(gear),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create gear item');
    }
    return response.json();
};

export const updateGearItem = async (gearId, gear) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/band-members/gear/${gearId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: gearFormData(gear),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update gear item');
    }
    return response.json();
};

export const deleteGearItem = async (gearId) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/band-members/gear/${gearId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to delete gear item');
    }
    return response.json();
};

/**
 * Get the admin analytics summary (page views, feature usage) for a date
 * range. Editor/admin only. `includeStaff` opts back into admin/editor-
 * tagged rows, which are excluded by default.
 */
export const getAnalyticsSummary = async ({ from, to, includeStaff = false } = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (includeStaff) params.set('includeStaff', 'true');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/analytics/summary?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to load analytics');
    }
    return response.json();
};

/**
 * Paginated, reverse-chronological analytics event log, each resolved to
 * the user who triggered it. Admin only (stricter than getAnalyticsSummary
 * — this names real people, not just aggregate counts).
 */
export const getAnalyticsEvents = async ({ from, to, includeStaff = false, eventType, page = 1, limit = 50 } = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (includeStaff) params.set('includeStaff', 'true');
    if (eventType) params.set('eventType', eventType);
    params.set('page', page);
    params.set('limit', limit);

    const response = await fetchWithAuth(`${API_BASE_URL}/api/analytics/events?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to load the audit log');
    }
    return response.json();
};

