import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { searchShows, getShows, checkShowAttendanceBatch, markShowAttended, unmarkShowAttended, checkShowsHaveContent } from '../services/api';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function SearchPage() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useState({
        year: '',
        month: '',
        venue: '',
        city: '',
        song: '',
        source: '',
        hasImages: false,
        hasNotes: false,
        hasPhotos: false,
        hasPoster: false
    });
    const [results, setResults] = useState([]);
    const [filteredResults, setFilteredResults] = useState([]); // Results after content filtering
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [attendanceMap, setAttendanceMap] = useState({}); // Track attendance for each show
    const [attendanceLoading, setAttendanceLoading] = useState({}); // Track loading state per show
    const [contentMap, setContentMap] = useState({}); // Track notes/photos for each show
    const [songStatsMap, setSongStatsMap] = useState({}); // Track unique songs per show: { showId: { originals: N, covers: N } }

    // Pagination state for standalone content filtering
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const ITEMS_PER_PAGE = 50;

    // Dropdown options
    const [years, setYears] = useState([]);
    const [venues, setVenues] = useState([]);
    const [cities, setCities] = useState([]);
    const [songs, setSongs] = useState([]);

    // Fetch ALL dropdown options (not filtered by current selections)
    useEffect(() => {
        const fetchDropdownOptions = async () => {
            try {
                // Fetch all shows to get all available options
                const { data: showsData } = await supabase
                    .from('shows')
                    .select(`
                        id,
                        show_date,
                        venue_id,
                        venues!inner (
                            id,
                            name,
                            city
                        )
                    `);

                if (showsData) {
                    // Extract unique years - parse as local date to avoid timezone issues
                    const uniqueYears = [...new Set(showsData.map(show => {
                        const [year] = show.show_date.split('-');
                        return parseInt(year);
                    }))].sort((a, b) => b - a);
                    setYears(uniqueYears);

                    // Extract unique venues
                    const uniqueVenues = [...new Set(showsData
                        .filter(show => show.venues)
                        .map(show => show.venues.name)
                    )].sort();
                    setVenues(uniqueVenues);

                    // Extract unique cities
                    const uniqueCities = [...new Set(showsData
                        .filter(show => show.venues)
                        .map(show => show.venues.city)
                    )].sort();
                    setCities(uniqueCities);

                    // Fetch all songs
                    const showIds = showsData.map(show => show.id);
                    const { data: setlistSongsData } = await supabase
                        .from('setlist_songs')
                        .select(`
                            songs!inner (
                                title
                            )
                        `)
                        .in('show_id', showIds);

                    if (setlistSongsData) {
                        const uniqueSongs = [...new Set(setlistSongsData
                            .map(ss => ss.songs?.title)
                            .filter(Boolean)
                        )].sort();
                        setSongs(uniqueSongs);
                    }
                }
            } catch (err) {
                console.error('Error fetching dropdown options:', err);
            }
        };

        fetchDropdownOptions();
    }, []); // Only fetch once on mount

    // Check attendance for all shows when results change (optimized batch request)
    useEffect(() => {
        const checkAllAttendance = async () => {
            if (!user || results.length === 0) {
                setAttendanceMap({});
                return;
            }

            console.log('[SearchPage] Checking attendance for', results.length, 'shows...');
            const startTime = Date.now();

            // Get all show IDs
            const showIds = results.map(show => show.id);

            // Single batch request instead of multiple individual requests
            const attendanceMap = await checkShowAttendanceBatch(showIds);

            const endTime = Date.now();
            console.log(`[SearchPage] Attendance checked in ${endTime - startTime}ms`);

            setAttendanceMap(attendanceMap);
        };

        checkAllAttendance();
    }, [results, user]);

    // Check for notes and photos when results change
    useEffect(() => {
        const checkContent = async () => {
            if (results.length === 0) {
                setContentMap({});
                setFilteredResults([]);
                return;
            }

            try {
                const showIds = results.map(show => show.id);
                const { contentMap } = await checkShowsHaveContent(showIds);
                setContentMap(contentMap);
            } catch (err) {
                console.error('Error checking content:', err);
                // Don't show error to user, just fail silently
            }
        };

        checkContent();
    }, [results]);

    // Calculate song statistics (unique originals and covers) per show
    useEffect(() => {
        const calculateSongStats = async () => {
            if (filteredResults.length === 0) {
                setSongStatsMap({});
                return;
            }

            try {
                // Fetch setlist songs for all shows in filtered results
                const showIds = filteredResults.map(show => show.id);
                console.log('[SearchPage] Calculating song stats for', showIds.length, 'shows');

                // Batch the queries if there are too many shows (Supabase has limits on IN clause)
                const BATCH_SIZE = 100;
                let allSetlistSongs = [];

                for (let i = 0; i < showIds.length; i += BATCH_SIZE) {
                    const batchIds = showIds.slice(i, i + BATCH_SIZE);
                    console.log('[SearchPage] Fetching batch', Math.floor(i / BATCH_SIZE) + 1, 'of', Math.ceil(showIds.length / BATCH_SIZE), '(', batchIds.length, 'shows)');

                    const { data: setlistSongs, error } = await supabase
                        .from('setlist_songs')
                        .select(`
                            show_id,
                            song_id,
                            id,
                            songs (
                                id,
                                is_original
                            )
                        `)
                        .in('show_id', batchIds);

                    if (error) {
                        console.error('[SearchPage] Error fetching setlist songs batch:', error);
                        continue; // Skip this batch but continue with others
                    }

                    if (setlistSongs) {
                        allSetlistSongs = allSetlistSongs.concat(setlistSongs);
                    }
                }

                console.log('[SearchPage] Fetched total of', allSetlistSongs.length, 'setlist songs');

                // Calculate stats per show
                const statsMap = {};

                showIds.forEach(showId => {
                    const showSongs = allSetlistSongs?.filter(item => item.show_id === showId) || [];

                    // Track unique songs by song_id
                    const uniqueSongIds = new Set();
                    let originals = 0;
                    let covers = 0;

                    showSongs.forEach(item => {
                        // Skip songs without song_id (should be rare/never after cleanup)
                        if (!item.song_id) {
                            console.warn('[SearchPage] Skipping setlist_song without song_id:', item.id);
                            return;
                        }

                        // Deduplicate by song_id
                        if (uniqueSongIds.has(item.song_id)) {
                            return; // Already counted this song
                        }
                        uniqueSongIds.add(item.song_id);

                        // Use ONLY the songs table as single source of truth
                        const isOriginal = item.songs?.is_original;

                        if (isOriginal === true) {
                            originals++;
                        } else if (isOriginal === false) {
                            covers++;
                        }
                        // If isOriginal is NULL/undefined, don't count it (needs to be fixed in DB)
                    });

                    statsMap[showId] = { originals, covers };
                });

                console.log('[SearchPage] Calculated stats for', Object.keys(statsMap).length, 'shows');
                setSongStatsMap(statsMap);

            } catch (err) {
                console.error('[SearchPage] Error calculating song stats:', err);
            }
        };

        calculateSongStats();
    }, [filteredResults]);

    // Filter results based on content filters (hasNotes, hasPhotos, hasPoster)
    useEffect(() => {
        if (results.length === 0) {
            setFilteredResults([]);
            return;
        }

        // Check if we need to apply content filters
        const needsContentFiltering = searchParams.hasNotes || searchParams.hasPhotos || searchParams.hasPoster;

        // If NO content filtering needed, just pass through all results immediately
        if (!needsContentFiltering) {
            console.log('[SearchPage] No content filtering needed, setting filteredResults =', results.length);
            setFilteredResults(results);
            return;
        }

        // If we need content filtering but contentMap is empty, wait for it to be populated
        if (Object.keys(contentMap).length === 0) {
            console.log('[SearchPage] Waiting for contentMap to populate...');
            return;
        }

        let filtered = [...results];

        console.log('[SearchPage] Starting content filtering. Results:', results.length, 'ContentMap size:', Object.keys(contentMap).length);

        // Apply content filters
        if (searchParams.hasNotes) {
            console.log('[SearchPage] Filtering by hasNotes');

            // Count how many shows have notes in the contentMap
            const showsWithNotes = Object.entries(contentMap).filter(([id, content]) => content.hasNotes);
            console.log('[SearchPage] Shows with notes in contentMap:', showsWithNotes.length);
            if (showsWithNotes.length > 0) {
                console.log('[SearchPage] Sample shows with notes:', showsWithNotes.slice(0, 3).map(([id, content]) => ({ id, ...content })));
            }

            const before = filtered.length;
            filtered = filtered.filter(show => contentMap[show.id]?.hasNotes);
            console.log('[SearchPage] After hasNotes filter:', filtered.length, '(removed', before - filtered.length, ')');
        }

        if (searchParams.hasPhotos) {
            console.log('[SearchPage] Filtering by hasPhotos');
            const before = filtered.length;
            filtered = filtered.filter(show => contentMap[show.id]?.hasPhotos);
            console.log('[SearchPage] After hasPhotos filter:', filtered.length, '(removed', before - filtered.length, ')');
        }

        if (searchParams.hasPoster) {
            console.log('[SearchPage] Filtering by hasPoster');
            const before = filtered.length;
            filtered = filtered.filter(show => contentMap[show.id]?.hasPoster);
            console.log('[SearchPage] After hasPoster filter:', filtered.length, '(removed', before - filtered.length, ')');
        }

        console.log('[SearchPage] Final filtered results:', filtered.length);
        setFilteredResults(filtered);
    }, [results, contentMap, searchParams.hasNotes, searchParams.hasPhotos, searchParams.hasPoster]);

    const hasActiveFilters = (params) => {
        return params.year || params.month || params.venue || params.city || params.song || params.source || params.hasImages || params.hasNotes || params.hasPhotos || params.hasPoster;
    };

    const hasContentOnlyFilters = (params) => {
        const hasContentFilters = params.hasNotes || params.hasPhotos || params.hasPoster;
        const hasOtherFilters = params.year || params.month || params.venue || params.city || params.song || params.source || params.hasImages;
        return hasContentFilters && !hasOtherFilters;
    };

    const handleAttendanceToggle = async (showId, e) => {
        e.preventDefault(); // Prevent navigation if button is inside a link
        e.stopPropagation();

        if (!user) {
            alert('Please log in to mark shows as attended');
            return;
        }

        setAttendanceLoading(prev => ({ ...prev, [showId]: true }));
        try {
            const isCurrentlyAttended = attendanceMap[showId];
            if (isCurrentlyAttended) {
                await unmarkShowAttended(showId);
                setAttendanceMap(prev => ({ ...prev, [showId]: false }));
            } else {
                await markShowAttended(showId);
                setAttendanceMap(prev => ({ ...prev, [showId]: true }));
            }
        } catch (err) {
            console.error('Error toggling attendance:', err);
            alert(err.message || 'Failed to update attendance');
        } finally {
            setAttendanceLoading(prev => ({ ...prev, [showId]: false }));
        }
    };

    const performSearch = async (params, page = 1) => {
        // Don't search if no filters are selected
        if (!hasActiveFilters(params)) {
            setResults([]);
            setCurrentPage(1);
            setTotalPages(1);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let data;

            // If only content filters are selected (hasNotes, hasPhotos, hasPoster),
            // we need to fetch shows in pages and filter client-side
            if (hasContentOnlyFilters(params)) {
                console.log('[SearchPage] Content-only filters detected, fetching page', page);
                // Fetch shows with pagination
                data = await getShows(page, ITEMS_PER_PAGE);
                console.log('[SearchPage] Fetched', data.shows?.length || 0, 'shows for content filtering');

                // Calculate total pages
                const total = Math.ceil((data.total || 0) / ITEMS_PER_PAGE);
                setTotalPages(total);
                setCurrentPage(page);
            } else {
                // Normal search with backend filters
                data = await searchShows(params);
                setCurrentPage(1);
                setTotalPages(1);
            }

            setResults(data.shows || []);
        } catch (err) {
            console.error('Search error:', err);
            setError('Failed to search shows. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        await performSearch(searchParams, 1);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newParams = {
            ...searchParams,
            [name]: type === 'checkbox' ? checked : value
        };
        setSearchParams(newParams);

        // Auto-search when filter changes (always start from page 1)
        performSearch(newParams, 1);
    };

    const clearFilter = (filterName) => {
        const newParams = {
            ...searchParams,
            [filterName]: ['hasImages', 'hasNotes', 'hasPhotos', 'hasPoster'].includes(filterName) ? false : ''
        };
        setSearchParams(newParams);

        // Auto-search after clearing filter (always start from page 1)
        performSearch(newParams, 1);
    };

    const loadNextPage = async () => {
        if (currentPage >= totalPages || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const nextPage = currentPage + 1;
            const data = await getShows(nextPage, ITEMS_PER_PAGE);

            // Append new results to existing results
            setResults(prev => [...prev, ...(data.shows || [])]);
            setCurrentPage(nextPage);
        } catch (err) {
            console.error('Error loading more shows:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const clearAllFilters = () => {
        const newParams = {
            year: '',
            month: '',
            venue: '',
            city: '',
            song: '',
            source: '',
            hasImages: false,
            hasNotes: false,
            hasPhotos: false,
            hasPoster: false
        };
        setSearchParams(newParams);
        setResults([]);
    };

    const getActiveFilters = () => {
        const filters = [];
        if (searchParams.year) filters.push({ name: 'year', label: 'Year', value: searchParams.year });
        if (searchParams.month) {
            const monthName = new Date(2000, searchParams.month - 1).toLocaleString('default', { month: 'long' });
            filters.push({ name: 'month', label: 'Month', value: monthName });
        }
        if (searchParams.venue) filters.push({ name: 'venue', label: 'Venue', value: searchParams.venue });
        if (searchParams.city) filters.push({ name: 'city', label: 'City', value: searchParams.city });
        if (searchParams.song) filters.push({ name: 'song', label: 'Song', value: searchParams.song });
        if (searchParams.source) filters.push({ name: 'source', label: 'Source', value: searchParams.source });
        if (searchParams.hasImages) filters.push({ name: 'hasImages', label: 'Has Images', value: 'Yes' });
        if (searchParams.hasNotes) filters.push({ name: 'hasNotes', label: 'Has Notes', value: 'Yes' });
        if (searchParams.hasPhotos) filters.push({ name: 'hasPhotos', label: 'Has Photos', value: 'Yes' });
        if (searchParams.hasPoster) filters.push({ name: 'hasPoster', label: 'Has Poster', value: 'Yes' });
        return filters;
    };

    return (
        <div className="px-4 py-8 max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Search Setlists
            </h1>

            <form onSubmit={handleSearch} className="bg-gray-800 shadow-2xl rounded-lg px-8 pt-6 pb-8 mb-8 border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Date Search */}
                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Year
                        </label>
                        <select
                            name="year"
                            value={searchParams.year}
                            onChange={handleInputChange}
                            className="bg-gray-700 border border-gray-600 rounded w-full py-2 px-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Years</option>
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Month
                        </label>
                        <select
                            name="month"
                            value={searchParams.month}
                            onChange={handleInputChange}
                            className="bg-gray-700 border border-gray-600 rounded w-full py-2 px-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Months</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                <option key={month} value={month}>
                                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Location and Song Search */}
                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Venue
                        </label>
                        <select
                            name="venue"
                            value={searchParams.venue}
                            onChange={handleInputChange}
                            className="bg-gray-700 border border-gray-600 rounded w-full py-2 px-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Venues</option>
                            {venues.map(venue => (
                                <option key={venue} value={venue}>{venue}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            City
                        </label>
                        <select
                            name="city"
                            value={searchParams.city}
                            onChange={handleInputChange}
                            className="bg-gray-700 border border-gray-600 rounded w-full py-2 px-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Cities</option>
                            {cities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Song
                        </label>
                        <select
                            name="song"
                            value={searchParams.song}
                            onChange={handleInputChange}
                            className="bg-gray-700 border border-gray-600 rounded w-full py-2 px-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Songs</option>
                            {songs.map(song => (
                                <option key={song} value={song}>{song}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content Filter Checkboxes */}
                <div className="mb-4">
                    <label className="block text-gray-300 text-sm font-bold mb-3">
                        Filter by Content
                    </label>
                    <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                name="hasNotes"
                                checked={searchParams.hasNotes}
                                onChange={handleInputChange}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <span className="ml-2 text-gray-300 text-sm">Has Notes</span>
                        </label>
                        <label className="inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                name="hasPhotos"
                                checked={searchParams.hasPhotos}
                                onChange={handleInputChange}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <span className="ml-2 text-gray-300 text-sm">Has Photos</span>
                        </label>
                        <label className="inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                name="hasPoster"
                                checked={searchParams.hasPoster}
                                onChange={handleInputChange}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <span className="ml-2 text-gray-300 text-sm">Has Poster</span>
                        </label>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400 italic">
                        {loading ? '🔍 Searching...' : '✨ Results update automatically as you select filters'}
                    </div>
                    {getActiveFilters().length > 0 && (
                        <button
                            type="button"
                            onClick={clearAllFilters}
                            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                        >
                            Clear All Filters
                        </button>
                    )}
                </div>
            </form>

            {/* Active Filters */}
            {getActiveFilters().length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg px-6 py-4 mb-6 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-300">Active Filters:</h3>
                        <button
                            onClick={clearAllFilters}
                            className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
                        >
                            Clear All
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {getActiveFilters().map(filter => (
                            <div
                                key={filter.name}
                                className="inline-flex items-center bg-blue-900/50 text-blue-200 px-3 py-1 rounded-full text-sm border border-blue-700"
                            >
                                <span className="font-medium mr-1">{filter.label}:</span>
                                <span className="mr-2">{filter.value}</span>
                                <button
                                    onClick={() => clearFilter(filter.name)}
                                    className="text-blue-300 hover:text-blue-100 font-bold transition-colors"
                                    aria-label={`Remove ${filter.label} filter`}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* Results */}
            <div className="bg-gray-800 shadow-2xl rounded-lg px-8 pt-6 pb-8 border border-gray-700">
                <h2 className="text-2xl font-bold mb-6 text-gray-100">
                    Results {filteredResults.length > 0 && `(${filteredResults.length})`}
                </h2>

                {!hasActiveFilters(searchParams) && !loading ? (
                    <div className="text-center py-8">
                        <p className="text-gray-400 text-lg mb-2">🔍 Select a filter to search for shows</p>
                        <p className="text-gray-500 text-sm">Choose a year, venue, city, song, or other filter to get started</p>
                    </div>
                ) : filteredResults.length === 0 && !loading ? (
                    <p className="text-gray-400">No shows found. Try adjusting your search criteria.</p>
                ) : (
                    <div className="space-y-4">
                        {filteredResults.map(show => {
                            const isAttended = attendanceMap[show.id] || false;
                            const isLoading = attendanceLoading[show.id] || false;
                            const hasNotes = contentMap[show.id]?.hasNotes || false;
                            const hasPhotos = contentMap[show.id]?.hasPhotos || false;
                            const hasPoster = contentMap[show.id]?.hasPoster || false;
                            const songStats = songStatsMap[show.id] || { originals: 0, covers: 0 };

                            return (
                                <div key={show.id} className="border border-gray-700 pb-4 hover:border-blue-500 transition-colors rounded-lg p-4 bg-gray-750 relative text-center">
                                    {/* Attendance Button - responsive positioning */}
                                    {user && (
                                        <div className="absolute top-2 right-2 md:top-4 md:right-4">
                                            <button
                                                onClick={(e) => handleAttendanceToggle(show.id, e)}
                                                disabled={isLoading}
                                                className={`px-2 py-1 md:px-4 md:py-2 rounded-lg font-medium text-xs md:text-sm transition-all whitespace-nowrap ${
                                                    isAttended
                                                        ? 'bg-green-900/50 text-green-200 border-2 border-green-700 hover:bg-green-900/70'
                                                        : 'bg-blue-900/50 text-blue-200 border-2 border-blue-700 hover:bg-blue-900/70'
                                                } disabled:opacity-50`}
                                            >
                                                {isLoading ? '...' : isAttended ? '✓' : '+'}
                                                <span className="hidden sm:inline ml-1">I Was There</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Centered content - add padding on mobile to avoid button overlap */}
                                    <div className={user ? 'pr-16 md:pr-0' : ''}>
                                        <h3 className="text-lg md:text-xl font-semibold text-gray-100">
                                            {(() => {
                                                // Parse date as local date to avoid timezone issues
                                                const [year, month, day] = show.show_date.split('-');
                                                const date = new Date(year, month - 1, day);
                                                return date.toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                });
                                            })()}
                                        </h3>
                                        <p className="text-gray-300 mt-1 text-sm md:text-base">
                                            {show.artist_name}
                                        </p>
                                        {show.venues && (
                                            <p className="text-gray-400 mt-1 text-xs md:text-sm">
                                                {show.venues.name} - {show.venues.city}, {show.venues.state_country}
                                            </p>
                                        )}

                                        {/* Content Badges - Notes, Photos, and Poster */}
                                        {(hasNotes || hasPhotos || hasPoster) && (
                                            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                                                {hasNotes && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-xs font-medium">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                        </svg>
                                                        <span>Notes</span>
                                                    </span>
                                                )}
                                                {hasPhotos && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-900/30 border border-blue-700/50 text-blue-300 text-xs font-medium">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                                        </svg>
                                                        <span>Photos</span>
                                                    </span>
                                                )}
                                                {hasPoster && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-900/30 border border-purple-700/50 text-purple-300 text-xs font-medium">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                                        </svg>
                                                        <span>Poster</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Song Stats Badges - Originals and Covers */}
                                        {(songStats.originals > 0 || songStats.covers > 0) && (
                                            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                                                {songStats.originals > 0 && (
                                                    <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded border border-green-700">
                                                        {songStats.originals} Original{songStats.originals !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {songStats.covers > 0 && (
                                                    <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded border border-blue-700">
                                                        {songStats.covers} Cover{songStats.covers !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {show.tour_name && (
                                            <p className="text-xs md:text-sm text-gray-500 italic mt-1">{show.tour_name}</p>
                                        )}
                                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:gap-3">
                                            <Link
                                                to={`/show/${show.id}`}
                                                className="text-blue-400 hover:text-blue-300 text-xs md:text-sm transition-colors"
                                            >
                                                View Setlist →
                                            </Link>
                                            {show.source_types && show.source_types.length > 0 && (
                                                <span className="text-xs text-gray-500">
                                                    Sources: {show.source_types.join(', ')}
                                                </span>
                                            )}
                                            {show.has_images && (
                                                <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded border border-green-700">
                                                    Has Images
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Load More Button for Standalone Content Filtering */}
                {hasContentOnlyFilters(searchParams) && currentPage < totalPages && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={loadNextPage}
                            disabled={isLoadingMore}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                        >
                            {isLoadingMore ? 'Loading...' : `Load More (Page ${currentPage + 1} of ${totalPages})`}
                        </button>
                        <p className="mt-2 text-sm text-gray-400">
                            Showing {results.length} shows loaded
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

