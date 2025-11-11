// API service for making calls to the backend
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Log the API URL for debugging
console.log('[API Service] Using API Base URL:', API_BASE_URL);

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
        throw new Error('Failed to search shows');
    }
    return response.json();
};

/**
 * Get all shows with pagination
 */
export const getShows = async (page = 1, limit = 20) => {
    const response = await fetch(`${API_BASE_URL}/api/shows?page=${page}&limit=${limit}`);
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
        throw new Error('Failed to fetch show');
    }
    return response.json();
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
// ADMIN FUNCTIONS
// ============================================

/**
 * Create a new show
 */
export const createShow = async (showData) => {
    const response = await fetch(`${API_BASE_URL}/api/shows`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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
    const response = await fetch(`${API_BASE_URL}/api/shows/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(showData),
    });
    if (!response.ok) {
        throw new Error('Failed to update show');
    }
    return response.json();
};

/**
 * Delete a show
 */
export const deleteShow = async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/shows/${id}`, {
        method: 'DELETE',
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
    const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/setlist`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
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
    const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/setlist/song`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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
    const response = await fetch(`${API_BASE_URL}/api/shows/${showId}/setlist/${setlistId}`, {
        method: 'DELETE',
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
 * Get authentication token from AuthContext
 * This is set by the setAuthTokenGetter function passed from AuthContext
 */
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

/**
 * Mark a show as attended
 */
export const markShowAttended = async (showId) => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/users/attended-shows/${showId}`, {
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
    return response.json();
};

/**
 * Unmark a show as attended
 */
export const unmarkShowAttended = async (showId) => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/users/attended-shows/${showId}`, {
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
    const token = getAuthToken();
    if (!token || !showIds || showIds.length === 0) {
        return {};
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/check-attendance-batch`, {
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
    const token = getAuthToken();
    if (!token) {
        return { attended: false };
    }

    const response = await fetch(`${API_BASE_URL}/api/users/check-attendance/${showId}`, {
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

    const token = getAuthToken();
    if (!token) {
        console.log('[API] getUserStats: No auth token');
        throw new Error('Not authenticated');
    }

    console.log('[API] getUserStats: Fetching from backend...');

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/stats`, {
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
 * Get all attended shows
 */
export const getAttendedShows = async () => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/users/attended-shows`, {
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
 * Get user's note for a show
 */
export const getUserNote = async (showId) => {
    const token = getAuthToken();
    if (!token) {
        return { note: null };
    }

    const response = await fetch(`${API_BASE_URL}/api/notes/user/${showId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch user note');
    }
    return response.json();
};

/**
 * Save or update a note
 */
export const saveNote = async (showId, noteText) => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/notes`, {
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
 * Delete a note
 */
export const deleteNote = async (noteId) => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/notes/${noteId}`, {
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
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('show_id', showId);
    if (caption) {
        formData.append('caption', caption);
    }

    const response = await fetch(`${API_BASE_URL}/api/photos/upload`, {
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
    return response.json();
};

/**
 * Update photo caption
 */
export const updatePhotoCaption = async (photoId, caption) => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/photos/${photoId}`, {
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
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/photos/${photoId}`, {
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
 * Upload a poster (replaces existing poster if any)
 */
export const uploadPoster = async (showId, file, caption = '') => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('poster', file);
    formData.append('show_id', showId);
    if (caption) {
        formData.append('caption', caption);
    }

    const response = await fetch(`${API_BASE_URL}/api/posters/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload poster');
    }
    return response.json();
};

/**
 * Update poster caption
 */
export const updatePosterCaption = async (posterId, caption) => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/posters/${posterId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ caption }),
    });
    if (!response.ok) {
        throw new Error('Failed to update poster caption');
    }
    return response.json();
};

/**
 * Delete a poster
 */
export const deletePoster = async (posterId) => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/posters/${posterId}`, {
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

