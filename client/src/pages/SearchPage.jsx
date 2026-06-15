import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { buildShowPath } from '../utils/showSlug';
import { searchShows, getShows, checkShowAttendanceBatch, markShowAttended, unmarkShowAttended, checkShowsHaveContent } from '../services/api';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import SongStatsWidget from '../components/SongStatsWidget';
import UserStatsWidget from '../components/UserStatsWidget';
import SEO from '../components/SEO';

export default function SearchPage() {
    const { user } = useAuth();

    // Tab state — synced to URL params for refresh persistence
    const [urlParams, setUrlParams] = useSearchParams();
    const activeTab = urlParams.get('tab') || 'search';
    const statsSubTab = urlParams.get('sub') || 'songs';

    const setActiveTab = (tab) => setUrlParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
    });
    const setStatsSubTab = (sub) => setUrlParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('sub', sub);
        return next;
    });

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
    const [songStatsLoading, setSongStatsLoading] = useState(false); // Track if song stats are being calculated

    // Use ref to track the current filteredResults IDs to avoid recalculating stats unnecessarily
    const lastCalculatedShowIds = useRef(null);

    // Dropdown options
    const [years, setYears] = useState([]);
    const [venues, setVenues] = useState([]);
    const [cities, setCities] = useState([]);
    const [songs, setSongs] = useState([]);

    // Fetch ALL dropdown options (not filtered by current selections)
    useEffect(() => {
        const fetchDropdownOptions = async () => {
            try {
                console.log('[SearchPage] Fetching dropdown options...');

                // Fetch all shows to get all available options
                const { data: showsData, error: showsError } = await supabase
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

                if (showsError) {
                    console.error('[SearchPage] Error fetching shows for dropdowns:', showsError);
                    setError('Failed to load search options. Please refresh the page.');
                    return;
                }

                if (showsData) {
                    console.log('[SearchPage] Loaded', showsData.length, 'shows for dropdowns');

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

                    // Fetch all songs with pagination (we have 5,899+ setlist_songs)
                    const showIds = showsData.map(show => show.id);
                    let allSetlistSongs = [];
                    let rangeStart = 0;
                    const PAGE_SIZE = 1000;
                    let hasMore = true;

                    while (hasMore) {
                        const rangeEnd = rangeStart + PAGE_SIZE - 1;

                        const { data: pageData, error: songsError, count } = await supabase
                            .from('setlist_songs')
                            .select(`
                                songs!setlist_songs_song_id_fkey!inner (
                                    title
                                )
                            `, { count: 'exact' })
                            .in('show_id', showIds)
                            .range(rangeStart, rangeEnd);

                        if (songsError) {
                            console.error('[SearchPage] Error fetching songs for dropdowns:', songsError);
                            break;
                        }

                        if (pageData && pageData.length > 0) {
                            allSetlistSongs = allSetlistSongs.concat(pageData);
                            rangeStart += PAGE_SIZE;

                            if (pageData.length < PAGE_SIZE || allSetlistSongs.length >= count) {
                                hasMore = false;
                            }
                        } else {
                            hasMore = false;
                        }
                    }

                    if (allSetlistSongs.length > 0) {
                        const uniqueSongs = [...new Set(allSetlistSongs
                            .map(ss => ss.songs?.title)
                            .filter(Boolean)
                        )].sort();
                        setSongs(uniqueSongs);
                        console.log('[SearchPage] Loaded', uniqueSongs.length, 'unique songs for dropdown (from', allSetlistSongs.length, 'setlist entries)');
                    }
                }
            } catch (err) {
                console.error('[SearchPage] Exception fetching dropdown options:', err);
                setError('Failed to load search options. Please refresh the page.');
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
                setSongStatsLoading(false);
                lastCalculatedShowIds.current = null;
                return;
            }

            // Check if we've already calculated stats for these exact shows
            const showIds = filteredResults.map(show => show.id);
            const showIdsKey = [...showIds].sort().join(',');

            if (lastCalculatedShowIds.current === showIdsKey) {
                return;
            }

            setSongStatsLoading(true);
            lastCalculatedShowIds.current = showIdsKey;

            try {

                // Batch the queries if there are too many shows (Supabase has limits on IN clause)
                const BATCH_SIZE = 100;
                let allSetlistSongs = [];

                for (let i = 0; i < showIds.length; i += BATCH_SIZE) {
                    const batchIds = showIds.slice(i, i + BATCH_SIZE);

                    // Fetch all rows using pagination (Supabase has a 1000 row limit by default)
                    let batchSetlistSongs = [];
                    let rangeStart = 0;
                    const PAGE_SIZE = 1000;
                    let hasMore = true;

                    while (hasMore) {
                        const rangeEnd = rangeStart + PAGE_SIZE - 1;

                        const { data: pageData, error, count } = await supabase
                            .from('setlist_songs')
                            .select(`
                                show_id,
                                song_id,
                                id,
                                songs!setlist_songs_song_id_fkey (
                                    id,
                                    is_original
                                )
                            `, { count: 'exact' })
                            .in('show_id', batchIds)
                            .range(rangeStart, rangeEnd);

                        if (error) {
                            console.error('[SearchPage] Error fetching setlist songs page:', error);
                            break;
                        }

                        if (pageData && pageData.length > 0) {
                            batchSetlistSongs = batchSetlistSongs.concat(pageData);
                            rangeStart += PAGE_SIZE;

                            // Check if we've fetched all rows
                            if (pageData.length < PAGE_SIZE || batchSetlistSongs.length >= count) {
                                hasMore = false;
                            }
                        } else {
                            hasMore = false;
                        }
                    }

                    allSetlistSongs = allSetlistSongs.concat(batchSetlistSongs);
                }

                // Calculate stats per show
                const statsMap = {};

                showIds.forEach((showId) => {
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

                setSongStatsMap(statsMap);
                setSongStatsLoading(false);

            } catch (err) {
                console.error('[SearchPage] Error calculating song stats:', err);
                setSongStatsLoading(false);
            }
        };

        calculateSongStats();
    }, [filteredResults]);

    // No longer need client-side content filtering - backend handles it now
    // Just sync filteredResults with results
    useEffect(() => {
        setFilteredResults(results);
    }, [results]);

    const hasActiveFilters = (params) => {
        return params.year || params.month || params.venue || params.city || params.song || params.source || params.hasImages || params.hasNotes || params.hasPhotos || params.hasPoster;
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

    const performSearch = async (params) => {
        // Don't search if no filters are selected
        if (!hasActiveFilters(params)) {
            setResults([]);
            setFilteredResults([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // All filters (including content filters) are now handled by the backend
            console.log('[SearchPage] Performing search with params:', params);
            const data = await searchShows(params);
            console.log('[SearchPage] Search returned', data.shows?.length || 0, 'shows');

            setResults(data.shows || []);
            setFilteredResults(data.shows || []); // No client-side filtering needed anymore
        } catch (err) {
            console.error('Search error:', err);
            setError('Failed to search shows. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        await performSearch(searchParams);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newParams = {
            ...searchParams,
            [name]: type === 'checkbox' ? checked : value
        };
        setSearchParams(newParams);

        // Auto-search when filter changes
        performSearch(newParams);
    };

    const clearFilter = (filterName) => {
        const newParams = {
            ...searchParams,
            [filterName]: ['hasImages', 'hasNotes', 'hasPhotos', 'hasPoster'].includes(filterName) ? false : ''
        };
        setSearchParams(newParams);

        // Auto-search after clearing filter
        performSearch(newParams);
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
        <div className="px-4 py-4 md:py-6 max-w-6xl mx-auto">
            <SEO
                title="Sturgill Simpson &amp; Johnny Blue Skies Setlists"
                description="The complete Sturgill Simpson and Johnny Blue Skies setlist database. Search 400+ concerts from 2012 to present, including the Why Not? and Who the F**k Is Johnny Blue Skies? tours."
            />

            {/* Tab Navigation */}
            <div className="grid grid-cols-2 gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('search')}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                        activeTab === 'search'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                    }`}
                >
                    🔍 Search
                </button>
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                        activeTab === 'stats'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                    }`}
                >
                    📊 Stats
                </button>
            </div>

            {/* Search Tab Content */}
            {activeTab === 'search' && (
                <>
                    <form onSubmit={handleSearch} className="bg-gray-800 shadow-2xl rounded-lg px-4 md:px-6 pt-5 pb-5 mb-6 border border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            {/* Date Search */}
                            <div>
                                <label className="block text-gray-300 text-xs font-semibold mb-1">
                                    Year
                                </label>
                                <select
                                    name="year"
                                    value={searchParams.year}
                                    onChange={handleInputChange}
                                    className="bg-gray-700 border border-gray-600 rounded w-full py-1.5 px-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">All Years</option>
                                    {years.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-gray-300 text-xs font-semibold mb-1">
                                    Month
                                </label>
                                <select
                                    name="month"
                                    value={searchParams.month}
                                    onChange={handleInputChange}
                                    className="bg-gray-700 border border-gray-600 rounded w-full py-1.5 px-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                            {/* Location and Song Search */}
                            <div>
                                <label className="block text-gray-300 text-xs font-semibold mb-1">
                                    Venue
                                </label>
                                <select
                                    name="venue"
                                    value={searchParams.venue}
                                    onChange={handleInputChange}
                                    className="bg-gray-700 border border-gray-600 rounded w-full py-1.5 px-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">All Venues</option>
                                    {venues.map(venue => (
                                        <option key={venue} value={venue}>{venue}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-gray-300 text-xs font-semibold mb-1">
                                    City
                                </label>
                                <select
                                    name="city"
                                    value={searchParams.city}
                                    onChange={handleInputChange}
                                    className="bg-gray-700 border border-gray-600 rounded w-full py-1.5 px-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">All Cities</option>
                                    {cities.map(city => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-gray-300 text-xs font-semibold mb-1">
                                    Song
                                </label>
                                <select
                                    name="song"
                                    value={searchParams.song}
                                    onChange={handleInputChange}
                                    className="bg-gray-700 border border-gray-600 rounded w-full py-1.5 px-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">All Songs</option>
                                    {songs.map(song => (
                                        <option key={song} value={song}>{song}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Content Filter Checkboxes */}
                        <div className="mb-3">
                            <label className="block text-gray-300 text-xs font-semibold mb-2">
                                Filter by Content
                            </label>
                            <div className="flex flex-wrap gap-3">
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="hasNotes"
                                        checked={searchParams.hasNotes}
                                        onChange={handleInputChange}
                                        className="w-3.5 h-3.5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                    <span className="ml-1.5 text-gray-300 text-xs">Notes</span>
                                </label>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="hasPhotos"
                                        checked={searchParams.hasPhotos}
                                        onChange={handleInputChange}
                                        className="w-3.5 h-3.5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                    <span className="ml-1.5 text-gray-300 text-xs">Photos</span>
                                </label>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="hasPoster"
                                        checked={searchParams.hasPoster}
                                        onChange={handleInputChange}
                                        className="w-3.5 h-3.5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                    <span className="ml-1.5 text-gray-300 text-xs">Poster</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-400 italic">
                                {loading ? '🔍 Searching...' : '✨ Results update automatically'}
                            </div>
                            {getActiveFilters().length > 0 && (
                                <button
                                    type="button"
                                    onClick={clearAllFilters}
                                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors text-sm"
                                >
                                    Clear All
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
                        {filteredResults.map((show, index) => {
                            const isAttended = attendanceMap[show.id] || false;
                            const isLoading = attendanceLoading[show.id] || false;
                            const hasNotes = contentMap[show.id]?.hasNotes || false;
                            const hasPhotos = contentMap[show.id]?.hasPhotos || false;
                            const hasPoster = contentMap[show.id]?.hasPoster || false;
                            const songStats = songStatsMap[show.id] || { originals: 0, covers: 0 };
                            const [sy, sm, sd] = show.show_date.split('-');
                            const today = new Date(); today.setHours(0, 0, 0, 0);
                            const isFutureShow = new Date(sy, sm - 1, sd) >= today;

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
                                                <span className="hidden sm:inline ml-1">
                                                    {isAttended
                                                        ? (isFutureShow ? "I'm Attending" : 'I Was There')
                                                        : (isFutureShow ? 'Mark as Attending' : 'Mark as Attended')}
                                                </span>
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

                                        {/* Song Stats Badges - Only show Covers count, Originals are implied */}
                                        {songStats.covers > 0 && (
                                            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                                                <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded border border-blue-700">
                                                    {songStats.covers} Cover{songStats.covers !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        )}
                                        {show.tour_name && (
                                            <p className="text-xs md:text-sm text-gray-500 italic mt-1">{show.tour_name}</p>
                                        )}
                                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:gap-3">
                                            <Link
                                                to={buildShowPath(show)}
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
                    </div>
                </>
            )}

            {/* Stats Tab Content */}
            {activeTab === 'stats' && (
                <div className="max-w-6xl mx-auto">
                    {/* Stats Sub-tabs */}
                    <div className="flex gap-2 mb-6 border-b border-gray-700">
                        <button
                            onClick={() => setStatsSubTab('songs')}
                            className={`px-6 py-3 font-medium transition-colors ${
                                statsSubTab === 'songs'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-gray-400 hover:text-gray-300'
                            }`}
                        >
                            Song Stats
                        </button>
                        <button
                            onClick={() => setStatsSubTab('mystats')}
                            className={`px-6 py-3 font-medium transition-colors ${
                                statsSubTab === 'mystats'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-gray-400 hover:text-gray-300'
                            }`}
                        >
                            My Stats
                        </button>
                    </div>

                    {/* Sub-tab Content */}
                    {statsSubTab === 'songs' && <SongStatsWidget />}
                    {statsSubTab === 'mystats' && <UserStatsWidget />}
                </div>
            )}
        </div>
    );
}

