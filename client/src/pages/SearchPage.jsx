import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    PHeading, PText, PButton, PButtonPure, PTag, PSpinner, PInlineNotification, PTabsBar
} from '@porsche-design-system/components-react';
import { buildShowPath } from '../utils/showSlug';
import { searchShows, checkShowAttendanceBatch, markShowAttended, unmarkShowAttended, checkShowsHaveContent } from '../services/api';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import SongStatsWidget from '../components/SongStatsWidget';
import UserStatsWidget from '../components/UserStatsWidget';
import SEO from '../components/SEO';

const MAIN_TABS = ['search', 'stats'];
const SUB_TABS = ['songs', 'mystats'];

const selectClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent";

export default function SearchPage() {
    const { user } = useAuth();

    const [urlParams, setUrlParams] = useSearchParams();
    const activeTab = urlParams.get('tab') || 'search';
    const statsSubTab = urlParams.get('sub') || 'songs';
    const mainTabIndex = Math.max(0, MAIN_TABS.indexOf(activeTab));
    const subTabIndex = Math.max(0, SUB_TABS.indexOf(statsSubTab));

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
        year: '', month: '', venue: '', city: '', song: '', source: '',
        hasImages: false, hasNotes: false, hasPhotos: false, hasPoster: false
    });
    const [results, setResults] = useState([]);
    const [filteredResults, setFilteredResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [attendanceMap, setAttendanceMap] = useState({});
    const [attendanceLoading, setAttendanceLoading] = useState({});
    const [contentMap, setContentMap] = useState({});
    const [songStatsMap, setSongStatsMap] = useState({});
    const [songStatsLoading, setSongStatsLoading] = useState(false);
    const lastCalculatedShowIds = useRef(null);

    const [years, setYears] = useState([]);
    const [venues, setVenues] = useState([]);
    const [cities, setCities] = useState([]);
    const [songs, setSongs] = useState([]);
    const [totalShows, setTotalShows] = useState(0);

    useEffect(() => {
        const fetchDropdownOptions = async () => {
            try {
                const { data: showsData, error: showsError } = await supabase
                    .from('shows')
                    .select('id, show_date, venue_id, venues!inner(id, name, city)');

                if (showsError) { setError('Failed to load search options. Please refresh the page.'); return; }

                if (showsData) {
                    setTotalShows(showsData.length);
                    setYears([...new Set(showsData.map(s => parseInt(s.show_date.split('-')[0])))].sort((a, b) => b - a));
                    setVenues([...new Set(showsData.filter(s => s.venues).map(s => s.venues.name))].sort());
                    setCities([...new Set(showsData.filter(s => s.venues).map(s => s.venues.city))].sort());

                    const showIds = showsData.map(s => s.id);
                    let allSetlistSongs = [];
                    let rangeStart = 0;
                    const PAGE_SIZE = 1000;
                    let hasMore = true;

                    while (hasMore) {
                        const { data: pageData, error: songsError, count } = await supabase
                            .from('setlist_songs')
                            .select('songs!setlist_songs_song_id_fkey!inner(title)', { count: 'exact' })
                            .in('show_id', showIds)
                            .range(rangeStart, rangeStart + PAGE_SIZE - 1);

                        if (songsError) break;
                        if (pageData?.length > 0) {
                            allSetlistSongs = allSetlistSongs.concat(pageData);
                            rangeStart += PAGE_SIZE;
                            if (pageData.length < PAGE_SIZE || allSetlistSongs.length >= count) hasMore = false;
                        } else { hasMore = false; }
                    }

                    if (allSetlistSongs.length > 0) {
                        setSongs([...new Set(allSetlistSongs.map(ss => ss.songs?.title).filter(Boolean))].sort());
                    }
                }
            } catch (err) {
                console.error('[SearchPage] Exception fetching dropdown options:', err);
                setError('Failed to load search options. Please refresh the page.');
            }
        };
        fetchDropdownOptions();
    }, []);

    useEffect(() => {
        const checkAllAttendance = async () => {
            if (!user || results.length === 0) { setAttendanceMap({}); return; }
            const map = await checkShowAttendanceBatch(results.map(s => s.id));
            setAttendanceMap(map);
        };
        checkAllAttendance();
    }, [results, user]);

    useEffect(() => {
        const checkContent = async () => {
            if (results.length === 0) { setContentMap({}); setFilteredResults([]); return; }
            try {
                const { contentMap } = await checkShowsHaveContent(results.map(s => s.id));
                setContentMap(contentMap);
            } catch (err) {
                console.error('Error checking content:', err);
            }
        };
        checkContent();
    }, [results]);

    useEffect(() => {
        const calculateSongStats = async () => {
            if (filteredResults.length === 0) {
                setSongStatsMap({}); setSongStatsLoading(false); lastCalculatedShowIds.current = null; return;
            }
            const showIds = filteredResults.map(s => s.id);
            const key = [...showIds].sort().join(',');
            if (lastCalculatedShowIds.current === key) return;

            setSongStatsLoading(true);
            lastCalculatedShowIds.current = key;

            try {
                const BATCH_SIZE = 100;
                let allSetlistSongs = [];
                for (let i = 0; i < showIds.length; i += BATCH_SIZE) {
                    const batchIds = showIds.slice(i, i + BATCH_SIZE);
                    let rangeStart = 0;
                    let hasMore = true;
                    while (hasMore) {
                        const { data: pageData, error, count } = await supabase
                            .from('setlist_songs')
                            .select('show_id, song_id, id, songs!setlist_songs_song_id_fkey(id, is_original)', { count: 'exact' })
                            .in('show_id', batchIds)
                            .range(rangeStart, rangeStart + 999);
                        if (error) break;
                        if (pageData?.length > 0) {
                            allSetlistSongs = allSetlistSongs.concat(pageData);
                            rangeStart += 1000;
                            if (pageData.length < 1000 || allSetlistSongs.length >= count) hasMore = false;
                        } else { hasMore = false; }
                    }
                }

                const statsMap = {};
                showIds.forEach(showId => {
                    const seen = new Set();
                    let originals = 0, covers = 0;
                    allSetlistSongs.filter(item => item.show_id === showId).forEach(item => {
                        if (!item.song_id || seen.has(item.song_id)) return;
                        seen.add(item.song_id);
                        if (item.songs?.is_original === true) originals++;
                        else if (item.songs?.is_original === false) covers++;
                    });
                    statsMap[showId] = { originals, covers };
                });

                setSongStatsMap(statsMap);
            } catch (err) {
                console.error('[SearchPage] Error calculating song stats:', err);
            } finally {
                setSongStatsLoading(false);
            }
        };
        calculateSongStats();
    }, [filteredResults]);

    useEffect(() => { setFilteredResults(results); }, [results]);

    const hasActiveFilters = (p) =>
        p.year || p.month || p.venue || p.city || p.song || p.source ||
        p.hasImages || p.hasNotes || p.hasPhotos || p.hasPoster;

    const handleAttendanceToggle = async (showId, e) => {
        e.preventDefault(); e.stopPropagation();
        if (!user) { alert('Please log in to mark shows as attended'); return; }
        setAttendanceLoading(prev => ({ ...prev, [showId]: true }));
        try {
            if (attendanceMap[showId]) {
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
        if (!hasActiveFilters(params)) { setResults([]); setFilteredResults([]); setLoading(false); return; }
        setLoading(true); setError(null);
        try {
            const data = await searchShows(params);
            setResults(data.shows || []);
            setFilteredResults(data.shows || []);
        } catch (err) {
            console.error('Search error:', err);
            setError('Failed to search shows. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newParams = { ...searchParams, [name]: type === 'checkbox' ? checked : value };
        setSearchParams(newParams);
        performSearch(newParams);
    };

    const setYearFilter = (year) => {
        const newParams = { ...searchParams, year: year.toString() };
        setSearchParams(newParams);
        performSearch(newParams);
    };

    const clearFilter = (filterName) => {
        const newParams = {
            ...searchParams,
            [filterName]: ['hasImages', 'hasNotes', 'hasPhotos', 'hasPoster'].includes(filterName) ? false : ''
        };
        setSearchParams(newParams);
        performSearch(newParams);
    };

    const clearAllFilters = () => {
        const newParams = { year: '', month: '', venue: '', city: '', song: '', source: '', hasImages: false, hasNotes: false, hasPhotos: false, hasPoster: false };
        setSearchParams(newParams);
        setResults([]);
    };

    const getActiveFilters = () => {
        const filters = [];
        if (searchParams.year) filters.push({ name: 'year', label: 'Year', value: searchParams.year });
        if (searchParams.month) filters.push({ name: 'month', label: 'Month', value: new Date(2000, searchParams.month - 1).toLocaleString('default', { month: 'long' }) });
        if (searchParams.venue) filters.push({ name: 'venue', label: 'Venue', value: searchParams.venue });
        if (searchParams.city) filters.push({ name: 'city', label: 'City', value: searchParams.city });
        if (searchParams.song) filters.push({ name: 'song', label: 'Song', value: searchParams.song });
        if (searchParams.source) filters.push({ name: 'source', label: 'Source', value: searchParams.source });
        if (searchParams.hasNotes) filters.push({ name: 'hasNotes', label: 'Has Notes', value: 'Yes' });
        if (searchParams.hasPhotos) filters.push({ name: 'hasPhotos', label: 'Has Photos', value: 'Yes' });
        if (searchParams.hasPoster) filters.push({ name: 'hasPoster', label: 'Has Poster', value: 'Yes' });
        return filters;
    };

    const activeFilters = getActiveFilters();
    const showHero = !hasActiveFilters(searchParams) && !loading;
    const showResults = hasActiveFilters(searchParams) || loading;

    return (
        <div className="px-4 py-4 md:py-6 max-w-6xl mx-auto">
            <SEO
                title="Sturgill Simpson &amp; Johnny Blue Skies Setlists"
                description="The complete Sturgill Simpson and Johnny Blue Skies setlist database. Search 400+ concerts from 2012 to present."
            />

            {/* Main Tabs */}
            <div className="mb-6">
                <PTabsBar
                    activeTabIndex={mainTabIndex}
                    onUpdate={(e) => setActiveTab(MAIN_TABS[e.detail.activeTabIndex])}
                >
                    <button>Search</button>
                    <button>Stats</button>
                </PTabsBar>
            </div>

            {/* Search Tab */}
            {activeTab === 'search' && (
                <>
                    {/* Filter Form */}
                    <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>Year</label>
                                <select name="year" value={searchParams.year} onChange={handleInputChange} className={selectClass}
                                    style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                    <option value="">All Years</option>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>Month</label>
                                <select name="month" value={searchParams.month} onChange={handleInputChange} className={selectClass}
                                    style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                    <option value="">All Months</option>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>Venue</label>
                                <select name="venue" value={searchParams.venue} onChange={handleInputChange} className={selectClass}
                                    style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                    <option value="">All Venues</option>
                                    {venues.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>City</label>
                                <select name="city" value={searchParams.city} onChange={handleInputChange} className={selectClass}
                                    style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                    <option value="">All Cities</option>
                                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>Song</label>
                                <select name="song" value={searchParams.song} onChange={handleInputChange} className={selectClass}
                                    style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                    <option value="">All Songs</option>
                                    {songs.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--p-color-contrast-medium)' }}>Filter by Content</label>
                            <div className="flex flex-wrap gap-4">
                                {[
                                    { name: 'hasNotes', label: 'Notes' },
                                    { name: 'hasPhotos', label: 'Photos' },
                                    { name: 'hasPoster', label: 'Poster' },
                                ].map(({ name, label }) => (
                                    <label key={name} className="inline-flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name={name}
                                            checked={searchParams[name]}
                                            onChange={handleInputChange}
                                            className="w-3.5 h-3.5 rounded accent-amber-400"
                                        />
                                        <span className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <PText size="x-small" color="contrast-medium">
                                {loading ? 'Searching…' : 'Results update automatically'}
                            </PText>
                            {activeFilters.length > 0 && (
                                <PButtonPure icon="close" onClick={clearAllFilters}>Clear All</PButtonPure>
                            )}
                        </div>
                    </div>

                    {/* Active Filter Pills */}
                    {activeFilters.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            {activeFilters.map(filter => (
                                <button
                                    key={filter.name}
                                    onClick={() => clearFilter(filter.name)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
                                >
                                    <span className="opacity-60">{filter.label}:</span>
                                    <span>{filter.value}</span>
                                    <span className="opacity-50 hover:opacity-100 font-bold ml-0.5">×</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mb-6">
                            <PInlineNotification heading="Search error" description={error} state="error" dismissButton={false} />
                        </div>
                    )}

                    {/* Hero state — shown when no filters are active */}
                    {showHero && (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-8 md:p-12">
                            <div className="text-center space-y-2 mb-10">
                                <div className="font-display font-bold text-8xl md:text-9xl leading-none text-amber-400">
                                    {totalShows || '400+'}
                                </div>
                                <p className="text-lg font-medium" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    concerts archived
                                </p>
                                {years.length >= 2 && (
                                    <p className="text-sm" style={{ color: 'var(--p-color-contrast-low)' }}>
                                        {years[years.length - 1]} — {years[0]}
                                    </p>
                                )}
                            </div>

                            {/* Quick year select */}
                            {years.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold uppercase tracking-widest text-center" style={{ color: 'var(--p-color-contrast-low)' }}>
                                        Browse by year
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {years.map(year => (
                                            <button
                                                key={year}
                                                onClick={() => setYearFilter(year)}
                                                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300 transition-all duration-150"
                                                style={{ color: 'var(--p-color-contrast-medium)' }}
                                            >
                                                {year}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Results */}
                    {showResults && (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <PHeading size="lg" tag="h2">
                                    Results {filteredResults.length > 0 && `(${filteredResults.length})`}
                                </PHeading>
                                {loading && <PSpinner size="small" aria={{ 'aria-label': 'Searching' }} />}
                            </div>

                            {filteredResults.length === 0 && !loading ? (
                                <PText color="contrast-medium">No shows found. Try adjusting your search criteria.</PText>
                            ) : (
                                <div className="space-y-2">
                                    {filteredResults.map((show) => {
                                        const isAttended = attendanceMap[show.id] || false;
                                        const isLoading = attendanceLoading[show.id] || false;
                                        const hasNotes = contentMap[show.id]?.hasNotes || false;
                                        const hasPhotos = contentMap[show.id]?.hasPhotos || false;
                                        const hasPoster = contentMap[show.id]?.hasPoster || false;
                                        const songStats = songStatsMap[show.id] || { originals: 0, covers: 0 };
                                        const [sy, sm, sd] = show.show_date.split('-');
                                        const showDateObj = new Date(sy, sm - 1, sd);
                                        const today = new Date(); today.setHours(0, 0, 0, 0);
                                        const isFutureShow = showDateObj >= today;
                                        const dayNum = parseInt(sd, 10);
                                        const monthStr = showDateObj.toLocaleString('default', { month: 'short' }).toUpperCase();

                                        return (
                                            <div
                                                key={show.id}
                                                className="flex rounded-xl border border-white/5 bg-white/5 hover:border-amber-500/20 hover:bg-white/[0.07] hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 transition-all duration-150 overflow-hidden"
                                            >
                                                {/* Date column */}
                                                <div className="shrink-0 flex flex-col items-center justify-center w-14 sm:w-16 py-4 bg-white/[0.02] border-r border-white/5">
                                                    <span className="font-display font-bold text-xl sm:text-2xl leading-none text-amber-400">
                                                        {dayNum}
                                                    </span>
                                                    <span className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                                        {monthStr}
                                                    </span>
                                                    <span className="text-[9px] mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                        {sy}
                                                    </span>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0 flex items-start justify-between gap-3 p-3 sm:p-4">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-sm" style={{ color: 'var(--p-color-primary)' }}>
                                                            {show.artist_name}
                                                        </p>
                                                        {show.venues && (
                                                            <>
                                                                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                                                    {show.venues.name}
                                                                </p>
                                                                <p className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                                    {show.venues.city}, {show.venues.state_country}
                                                                </p>
                                                            </>
                                                        )}
                                                        {show.tour_name && (
                                                            <p className="text-xs mt-0.5 italic" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                                {show.tour_name}
                                                            </p>
                                                        )}
                                                        {(hasNotes || hasPhotos || hasPoster || songStats.covers > 0) && (
                                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                                {hasNotes && <PTag color="notification-warning-soft">Notes</PTag>}
                                                                {hasPhotos && <PTag color="notification-info-soft">Photos</PTag>}
                                                                {hasPoster && <PTag>Poster</PTag>}
                                                                {songStats.covers > 0 && (
                                                                    <PTag color="notification-info-soft">
                                                                        {songStats.covers} Cover{songStats.covers !== 1 ? 's' : ''}
                                                                    </PTag>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="shrink-0 flex flex-col items-end gap-2 pt-0.5">
                                                        {user && (
                                                            <PButton
                                                                variant={isAttended ? 'primary' : 'secondary'}
                                                                size="small"
                                                                loading={isLoading}
                                                                onClick={(e) => handleAttendanceToggle(show.id, e)}
                                                            >
                                                                <span className="hidden sm:inline">
                                                                    {isAttended
                                                                        ? (isFutureShow ? 'Attending' : 'I Was There')
                                                                        : (isFutureShow ? 'Going?' : 'Attended?')}
                                                                </span>
                                                                <span className="sm:hidden">{isAttended ? '✓' : '+'}</span>
                                                            </PButton>
                                                        )}
                                                        <Link to={buildShowPath(show)}>
                                                            <PButtonPure icon="arrow-right" iconPosition="end" size="small">
                                                                View
                                                            </PButtonPure>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
                <div className="space-y-6">
                    <PTabsBar
                        activeTabIndex={subTabIndex}
                        onUpdate={(e) => setStatsSubTab(SUB_TABS[e.detail.activeTabIndex])}
                    >
                        <button>Song Stats</button>
                        <button>My Stats</button>
                    </PTabsBar>

                    {statsSubTab === 'songs' && <SongStatsWidget />}
                    {statsSubTab === 'mystats' && <UserStatsWidget />}
                </div>
            )}
        </div>
    );
}
