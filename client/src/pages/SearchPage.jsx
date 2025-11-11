import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { searchShows, checkShowAttendanceBatch, markShowAttended, unmarkShowAttended } from '../services/api';
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
        hasImages: false
    });
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [attendanceMap, setAttendanceMap] = useState({}); // Track attendance for each show
    const [attendanceLoading, setAttendanceLoading] = useState({}); // Track loading state per show

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

    const hasActiveFilters = (params) => {
        return params.year || params.month || params.venue || params.city || params.song || params.source || params.hasImages;
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
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await searchShows(params);
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
            [filterName]: filterName === 'hasImages' ? false : ''
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
            hasImages: false
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
                    Results {results.length > 0 && `(${results.length})`}
                </h2>

                {!hasActiveFilters(searchParams) && !loading ? (
                    <div className="text-center py-8">
                        <p className="text-gray-400 text-lg mb-2">🔍 Select a filter to search for shows</p>
                        <p className="text-gray-500 text-sm">Choose a year, venue, city, song, or other filter to get started</p>
                    </div>
                ) : results.length === 0 && !loading ? (
                    <p className="text-gray-400">No shows found. Try adjusting your search criteria.</p>
                ) : (
                    <div className="space-y-4">
                        {results.map(show => {
                            const isAttended = attendanceMap[show.id] || false;
                            const isLoading = attendanceLoading[show.id] || false;

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
            </div>
        </div>
    );
}

