// API service for making calls to the backend
import { supabase } from './supabase';

const API_BASE_URL = 'http://localhost:3000/api';

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

    const response = await fetch(`${API_BASE_URL}/search/shows?${params}`);
    if (!response.ok) {
        throw new Error('Failed to search shows');
    }
    return response.json();
};

/**
 * Get all shows with pagination
 */
export const getShows = async (page = 1, limit = 20) => {
    const response = await fetch(`${API_BASE_URL}/shows?page=${page}&limit=${limit}`);
    if (!response.ok) {
        throw new Error('Failed to fetch shows');
    }
    return response.json();
};

/**
 * Get a single show by ID with full setlist
 */
export const getShowById = async (id) => {
    const response = await fetch(`${API_BASE_URL}/shows/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch show');
    }
    return response.json();
};

/**
 * Get all songs
 */
export const getSongs = async () => {
    const response = await fetch(`${API_BASE_URL}/songs`);
    if (!response.ok) {
        throw new Error('Failed to fetch songs');
    }
    return response.json();
};

/**
 * Get a single song by ID with performance history
 */
export const getSongById = async (id) => {
    const response = await fetch(`${API_BASE_URL}/songs/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch song');
    }
    return response.json();
};

/**
 * Get all venues
 */
export const getVenues = async () => {
    const response = await fetch(`${API_BASE_URL}/venues`);
    if (!response.ok) {
        throw new Error('Failed to fetch venues');
    }
    return response.json();
};

/**
 * Get a single venue by ID with all shows
 */
export const getVenueById = async (id) => {
    const response = await fetch(`${API_BASE_URL}/venues/${id}`);
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

    const response = await fetch(`${API_BASE_URL}/search/songs?${params}`);
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
    const response = await fetch(`${API_BASE_URL}/shows`, {
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
    const response = await fetch(`${API_BASE_URL}/shows/${id}`, {
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
    const response = await fetch(`${API_BASE_URL}/shows/${id}`, {
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
    const response = await fetch(`${API_BASE_URL}/shows/${showId}/setlist`, {
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
    const response = await fetch(`${API_BASE_URL}/shows/${showId}/setlist/song`, {
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
    const response = await fetch(`${API_BASE_URL}/shows/${showId}/setlist/${setlistId}`, {
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
 * Get authentication token from Supabase
 */
const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
};

/**
 * Mark a show as attended
 */
export const markShowAttended = async (showId) => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/users/attended-shows/${showId}`, {
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
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/users/attended-shows/${showId}`, {
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
        const response = await fetch(`${API_BASE_URL}/users/check-attendance-batch`, {
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

    const response = await fetch(`${API_BASE_URL}/users/check-attendance/${showId}`, {
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
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/users/stats`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch user statistics');
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

    const response = await fetch(`${API_BASE_URL}/users/attended-shows`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch attended shows');
    }
    return response.json();
};

