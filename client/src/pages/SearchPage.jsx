import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    PHeading, PText, PSpinner, PInlineNotification
} from '@porsche-design-system/components-react';
import { buildShowPath } from '../utils/showSlug';
import { searchShows, checkShowAttendanceBatch, markShowAttended, unmarkShowAttended, checkShowsHaveContent, getBands, getShowDebutsBatch } from '../services/apiCore';
import { getTourRarity } from '../services/api';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import TourStatsWidget from '../components/TourStatsWidget';
import UpcomingShowsWidget from '../components/UpcomingShowsWidget';
import MostRecentShowWidget from '../components/MostRecentShowWidget';
import NextShowWidget from '../components/NextShowWidget';
import ShowTagsRow from '../components/ShowTagsRow';
import MainNavTabs from '../components/MainNavTabs';
import { computeShowTagCounts } from '../utils/setlist';
import { getLiveCoverTitles, getSundayValleyTitles } from '../utils/coverSongs';
import { fetchGeographyOptions } from '../utils/geography';
import { getLocalDateString } from '../utils/today';
import SEO from '../components/SEO';

// Lazy, not a static import — these only render on the Stats/My Shows tabs
// (never the default "search" view everyone lands on first), but were
// shipping in the main bundle regardless. UserStatsWidget in particular
// pulls in ShowMapShare, and with it Leaflet — PageSpeed flagged ~133KB of
// unused JS in the main bundle, and these two tab-gated widgets are the
// single biggest reachable-but-unrendered chunk of it.
const SongStatsWidget = lazy(() => import('../components/SongStatsWidget'));
const UserStatsWidget = lazy(() => import('../components/UserStatsWidget'));

const selectClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent";

export default function SearchPage() {
    const { user, isEditorOrAdmin } = useAuth();

    const [urlParams] = useSearchParams();
    const activeTab = urlParams.get('tab') || 'search';

    const [searchParams, setSearchParams] = useState({
        year: '', month: '', song: '', source: '', state: '', country: '',
        hasNotes: false, hasPhotos: false, hasPoster: false, isCancelled: false
    });
    const [results, setResults] = useState([]);
    const [filteredResults, setFilteredResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [attendanceMap, setAttendanceMap] = useState({});
    const [attendanceLoading, setAttendanceLoading] = useState({});
    const [contentMap, setContentMap] = useState({});
    const [tagCountsMap, setTagCountsMap] = useState({}); // showId -> {coverCount, teaseCount, rareCount, liveDebutCount, tourDebutCount}
    const [songStatsLoading, setSongStatsLoading] = useState(false);
    const lastCalculatedShowIds = useRef(null);

    const [sortOrder, setSortOrder] = useState('newest');

    const [years, setYears] = useState([]);
    // Played (past, not canceled) show count for the homepage intro — derived
    // from the same years query, no extra request.
    const [playedShowCount, setPlayedShowCount] = useState(null);
    // Gates the search tab's body: the "Browse by year" card only exists once
    // years load, and appearing late it pushed the filter bar and hero down.
    const [yearsLoaded, setYearsLoaded] = useState(false);
    // undefined = not loaded yet, null = loaded but no current tour.
    const [recentTourName, setRecentTourName] = useState(undefined);

    // The four hero widgets each load independently with data-dependent
    // heights, so revealing them one at a time pushed everything below
    // down as each finished — the source of the homepage's CLS. They mount
    // (and fetch) hidden, and the whole section appears at once when all
    // four report ready. A Set, not a counter, so StrictMode's double-run
    // effects can't count one widget twice.
    const [heroReady, setHeroReady] = useState(false);
    const heroReadyKeys = useRef(new Set());
    const markHeroReady = (key) => {
        heroReadyKeys.current.add(key);
        if (heroReadyKeys.current.size === 4) setHeroReady(true);
    };
    // Fallback so a hung request can't leave the section hidden forever.
    useEffect(() => {
        const t = setTimeout(() => setHeroReady(true), 5000);
        return () => clearTimeout(t);
    }, []);
    const [originalsByAlbum, setOriginalsByAlbum] = useState([]);
    const [coverSongs, setCoverSongs] = useState([]);
    const [sundayValleySongs, setSundayValleySongs] = useState([]);
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [geoOptions, setGeoOptions] = useState({ states: [], countries: [] });
    // Whether the filter-panel-only data below has been fetched yet — not
    // just `filterPanelOpen` itself, so closing and reopening the panel
    // doesn't re-fetch every time.
    const filterDataLoadedRef = useRef(false);

    // Years-only, eager — "Browse by year" renders immediately on the
    // default homepage view, unlike everything in the collapsed Advanced
    // Filters panel below. Dropped the venues join and `totalShows` (never
    // actually read anywhere) that the old combined query here carried.
    // tour_name/day_order are included so the most-recent-tour lookup
    // TourStatsWidget used to run as its own separate round trip can be
    // derived client-side from this same response instead — PageSpeed's
    // network-dependency-tree audit flagged that widget's fully sequential
    // "which tour" -> tour shows -> tour setlist -> debuts-batch chain as
    // the page's longest critical path; this removes the first hop from it.
    useEffect(() => {
        const fetchYears = async () => {
            try {
                const { data: showsData, error: showsError } = await supabase
                    .from('shows')
                    .select('show_date, tour_name, day_order, is_cancelled');
                if (showsError) {
                    setError('Failed to load search options. Please refresh the page.');
                    setRecentTourName(null);
                    return;
                }
                if (showsData) {
                    setYears([...new Set(showsData.map(s => parseInt(s.show_date.split('-')[0])))].sort((a, b) => b - a));

                    const todayStr = getLocalDateString();
                    setPlayedShowCount(showsData.filter(s => s.show_date <= todayStr && !s.is_cancelled).length);
                    const past = showsData
                        // A non-tour side event (an afterparty, a one-off) has no
                        // tour_name — excluded here, not just left to fall through
                        // "|| null" below, since one of these dated later than the
                        // actual tour show the same night (higher day_order) would
                        // otherwise win the sort and should never: the whole point
                        // of this is to find the tour currently showing on the
                        // homepage widget, and a blank tour_name can never be that.
                        .filter(s => s.show_date <= todayStr && s.tour_name)
                        .sort((a, b) => b.show_date.localeCompare(a.show_date) || (b.day_order ?? 0) - (a.day_order ?? 0));
                    setRecentTourName(past[0]?.tour_name || null);
                }
            } catch (err) {
                console.error('[SearchPage] Exception fetching years:', err);
                setError('Failed to load search options. Please refresh the page.');
                setRecentTourName(null);
            } finally {
                setYearsLoaded(true);
            }
        };
        fetchYears();
    }, []);

    // Geography options + the songs-derived filter lists (originals by
    // album, covers, Sunday Valley) are ALL only rendered inside the
    // collapsed-by-default Advanced Filters panel — fetching them eagerly
    // on every homepage load (as this used to) put a venues query and a
    // full songs-catalog query (with an album_songs join) on the critical
    // path for every visitor, the vast majority of whom never open that
    // panel at all. Deferred until first open instead; the active-filter
    // chips above the panel read straight off the URL params, not these
    // lists, so a filter already active via URL still displays correctly
    // before this has loaded.
    useEffect(() => {
        if (!filterPanelOpen || filterDataLoadedRef.current) return;
        filterDataLoadedRef.current = true;

        fetchGeographyOptions()
            .then(setGeoOptions)
            .catch(err => console.error('[SearchPage] Error fetching geography options:', err));

        const fetchSongFilterOptions = async () => {
            try {
                // Fetch all songs directly — avoids passing hundreds of show IDs
                // in a URL which exceeds PostgREST's length limit.
                const { data: songsData, error: songsError } = await supabase
                    .from('songs')
                    .select('id, title, is_original, is_sunday_valley, album_songs(album_id, track_order, albums(id, title, release_date))')
                    .order('title');

                if (songsError || !songsData?.length) return;
                const uniqueSongs = songsData;

                // Covers — flat alphabetical list, live performances only
                // (excludes songs only ever DJ'd between/after sets)
                setCoverSongs(await getLiveCoverTitles(uniqueSongs));
                setSundayValleySongs(getSundayValleyTitles(uniqueSongs));

                // Originals (wherever they appear), plus covers that are
                // real album tracks — grouped by album via junction table,
                // newest album first. A song may appear in multiple albums.
                const albumMap = new Map();
                uniqueSongs.filter(s => s.is_original === true || (s.album_songs && s.album_songs.length > 0)).forEach(song => {
                    const assocs = song.album_songs && song.album_songs.length > 0 ? song.album_songs : null;
                    if (assocs) {
                        assocs.forEach(as => {
                            const key = as.album_id;
                            const albumTitle = as.albums?.title || 'Other';
                            const releaseDate = as.albums?.release_date || '';
                            if (!albumMap.has(key)) albumMap.set(key, { name: albumTitle, releaseDate, songs: [] });
                            if (!albumMap.get(key).songs.includes(song.title)) {
                                albumMap.get(key).songs.push(song.title);
                            }
                        });
                    } else {
                        const key = '__none__';
                        if (!albumMap.has(key)) albumMap.set(key, { name: 'Other', releaseDate: '', songs: [] });
                        albumMap.get(key).songs.push(song.title);
                    }
                });
                setOriginalsByAlbum(
                    [...albumMap.values()]
                        .sort((a, b) => {
                            if (!a.releaseDate) return 1;
                            if (!b.releaseDate) return -1;
                            return b.releaseDate.localeCompare(a.releaseDate);
                        })
                        .map(album => ({ ...album, songs: [...album.songs].sort((a, b) => a.localeCompare(b)) }))
                );
            } catch (err) {
                console.error('[SearchPage] Exception fetching song filter options:', err);
            }
        };
        fetchSongFilterOptions();
    }, [filterPanelOpen]);

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
        const calculateTagCounts = async () => {
            if (filteredResults.length === 0) {
                setTagCountsMap({}); setSongStatsLoading(false); lastCalculatedShowIds.current = null; return;
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
                            .select('show_id, song_id, performance_type, songs!setlist_songs_song_id_fkey(is_original)', { count: 'exact' })
                            .in('show_id', batchIds)
                            .order('id')
                            .range(rangeStart, rangeStart + 999);
                        if (error) break;
                        if (pageData?.length > 0) {
                            allSetlistSongs = allSetlistSongs.concat(pageData);
                            rangeStart += 1000;
                            if (pageData.length < 1000 || allSetlistSongs.length >= count) hasMore = false;
                        } else { hasMore = false; }
                    }
                }

                // Group once rather than re-scanning every row per show.
                const rowsByShow = {};
                allSetlistSongs.forEach(item => {
                    (rowsByShow[item.show_id] ||= []).push(item);
                });

                // Rare depends on tour-wide play counts — fetched once per distinct tour
                // represented in the results (not once per show), reusing
                // GET /shows/:id/tour-rarity with any show id from that tour.
                const tourRarityByTour = {};
                const tourReps = new Map();
                filteredResults.forEach(s => { if (s.tour_name && !tourReps.has(s.tour_name)) tourReps.set(s.tour_name, s.id); });
                await Promise.all([...tourReps.entries()].map(async ([tourName, repId]) => {
                    try {
                        tourRarityByTour[tourName] = await getTourRarity(repId);
                    } catch (err) {
                        console.error('[SearchPage] tour rarity fetch failed:', err);
                    }
                }));

                // Debuts, batched in one call rather than one request per row — only for
                // shows that actually have a setlist logged.
                const showIdsWithSetlist = showIds.filter(id => rowsByShow[id]?.length > 0);
                const debutsByShow = showIdsWithSetlist.length > 0
                    ? await getShowDebutsBatch(showIdsWithSetlist).catch(err => {
                        console.error('[SearchPage] Error fetching debuts batch:', err);
                        return {};
                    })
                    : {};

                const tagsMap = {};
                filteredResults.forEach(s => {
                    const rows = rowsByShow[s.id] || [];
                    const tourRarity = s.tour_name ? tourRarityByTour[s.tour_name] : undefined;
                    const liveDebutIds = new Set(debutsByShow[s.id]?.live_debut_song_ids || []);
                    const tourDebutIds = new Set(debutsByShow[s.id]?.tour_debut_song_ids || []);
                    tagsMap[s.id] = computeShowTagCounts(rows, tourRarity, liveDebutIds, tourDebutIds);
                });

                setTagCountsMap(tagsMap);
            } catch (err) {
                console.error('[SearchPage] Error calculating tag counts:', err);
            } finally {
                setSongStatsLoading(false);
            }
        };
        calculateTagCounts();
    }, [filteredResults]);

    useEffect(() => { setFilteredResults(results); }, [results]);

    const hasActiveFilters = (p) =>
        p.year || p.month || p.song || p.source || p.state || p.country ||
        p.hasNotes || p.hasPhotos || p.hasPoster || p.isCancelled;

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

    // Hydrate filters from the URL once on mount — e.g. an admin "view shows"
    // link like /?song=Kansas%20City encodes a filter, but this page's own UI
    // never touches the URL, so without this the link lands on an unfiltered
    // page instead of actually applying the song filter it carries.
    useEffect(() => {
        const song = urlParams.get('song') || '';
        const year = urlParams.get('year') || '';
        const month = urlParams.get('month') || '';
        const source = urlParams.get('source') || '';
        const state = urlParams.get('state') || '';
        const country = urlParams.get('country') || '';
        const hasNotes = urlParams.get('hasNotes') === 'true';
        const hasPhotos = urlParams.get('hasPhotos') === 'true';
        const hasPoster = urlParams.get('hasPoster') === 'true';
        const isCancelled = urlParams.get('isCancelled') === 'true';

        if (!song && !year && !month && !source && !state && !country && !hasNotes && !hasPhotos && !hasPoster && !isCancelled) return;

        const initParams = { year, month, song, source, state, country, hasNotes, hasPhotos, hasPoster, isCancelled };
        setSearchParams(initParams);
        performSearch(initParams);
        // Intentionally only ever hydrates from the URL once, on first load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const setMonthFilter = (month) => {
        const newParams = { ...searchParams, month: month.toString() };
        setSearchParams(newParams);
        performSearch(newParams);
    };

    const clearFilter = (filterName) => {
        const newParams = {
            ...searchParams,
            [filterName]: ['hasNotes', 'hasPhotos', 'hasPoster', 'isCancelled'].includes(filterName) ? false : ''
        };
        setSearchParams(newParams);
        performSearch(newParams);
    };

    const clearAllFilters = () => {
        const newParams = { year: '', month: '', song: '', source: '', state: '', country: '', hasNotes: false, hasPhotos: false, hasPoster: false, isCancelled: false };
        setSearchParams(newParams);
        setResults([]);
    };

    // Separate from clearAllFilters (used by the in-panel "Clear All" button,
    // which should leave the panel open so the user can keep adjusting
    // filters) — the home icon clears filters *and* collapses the panel,
    // landing back on the same clean default view as a fresh page load.
    const handleHomeClick = () => {
        clearAllFilters();
        setFilterPanelOpen(false);
    };

    const getActiveFilters = () => {
        const filters = [];
        if (searchParams.year) filters.push({ name: 'year', label: 'Year', value: searchParams.year });
        if (searchParams.month) filters.push({ name: 'month', label: 'Month', value: new Date(2000, searchParams.month - 1).toLocaleString('default', { month: 'long' }) });
        if (searchParams.song) filters.push({ name: 'song', label: 'Song', value: searchParams.song });
        if (searchParams.source) filters.push({ name: 'source', label: 'Source', value: searchParams.source });
        if (searchParams.state) filters.push({ name: 'state', label: 'State', value: searchParams.state });
        if (searchParams.country) filters.push({ name: 'country', label: 'Country', value: searchParams.country });
        if (searchParams.hasNotes) filters.push({ name: 'hasNotes', label: 'Has Comments', value: 'Yes' });
        if (searchParams.hasPhotos) filters.push({ name: 'hasPhotos', label: 'Has Photos', value: 'Yes' });
        if (searchParams.hasPoster) filters.push({ name: 'hasPoster', label: 'Has Poster', value: 'Yes' });
        if (searchParams.isCancelled) filters.push({ name: 'isCancelled', label: 'Canceled', value: 'Yes' });
        return filters;
    };

    const activeFilters = getActiveFilters();
    const showHero = !hasActiveFilters(searchParams) && !loading;
    const showResults = hasActiveFilters(searchParams) || loading;

    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-6xl mx-auto">
            <SEO
                title="Johnny Blue Skies &amp; Sturgill Simpson Concert Setlists"
                description="The complete Johnny Blue Skies &amp; The Dark Clouds and Sturgill Simpson concert setlist archive — search nearly 700 shows since 2005."
            />

            <MainNavTabs onHomeClick={handleHomeClick} />

            {/* Search Tab */}
            {activeTab === 'search' && !yearsLoaded && <div className="min-h-screen" />}

            {/* Hidden rather than unmounted, so the hero widgets inside still
                start fetching immediately instead of waiting on years. */}
            {activeTab === 'search' && (
                <div className={yearsLoaded ? undefined : 'hidden'}>
                    {/* The page's one <h1> plus a few sentences of real text —
                        the homepage otherwise had no heading and almost no
                        indexable copy, just widgets. Inside the yearsLoaded
                        gate so it appears with everything else (no layout
                        shift), and the numbers come from that same query. */}
                    <div className="mb-4 px-1">
                        <h1 className="font-display font-bold text-2xl md:text-3xl leading-tight" style={{ color: 'var(--p-color-primary)' }}>
                            Johnny Blue Skies &amp; Sturgill Simpson Setlists
                        </h1>
                        <p className="text-sm mt-2 max-w-3xl" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Every known setlist from Sturgill Simpson&rsquo;s live career —{' '}
                            {playedShowCount ? `${playedShowCount.toLocaleString()} shows` : 'hundreds of shows'}
                            {years.length > 0 && ` since ${Math.min(...years)}`}, through Johnny Blue Skies &amp; The Dark Clouds.
                            Look up any show&rsquo;s full setlist, follow a song&rsquo;s complete performance history, and browse
                            photos, posters and tour stats from fans who were there.
                        </p>
                    </div>

                    {/* Browse by year — always visible above filters */}
                    {years.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] px-5 py-4 mb-4">
                            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--p-color-contrast-low)' }}>
                                Browse by year
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {years.map(year => (
                                    <button
                                        key={year}
                                        onClick={() => searchParams.year === year.toString() ? clearFilter('year') : setYearFilter(year)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                                            searchParams.year === year.toString()
                                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                                : 'border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300'
                                        }`}
                                        style={searchParams.year !== year.toString() ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Filter bar */}
                    <div className="rounded-2xl border border-white/10 bg-[#1a1e26] mb-6 overflow-hidden">
                        {/* Toggle header — always visible */}
                        <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                            <button
                                onClick={() => setFilterPanelOpen(o => !o)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0"
                                style={{
                                    borderColor: filterPanelOpen ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.15)',
                                    color: filterPanelOpen ? '#fbbf24' : 'var(--p-color-contrast-medium)',
                                    background: filterPanelOpen ? 'rgba(245,158,11,0.08)' : 'transparent',
                                }}
                            >
                                <svg aria-hidden="true"
                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${filterPanelOpen ? '' : '-rotate-90'}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                                Advanced Filters{activeFilters.length > 0 && ` (${activeFilters.length})`}
                            </button>

                            {activeFilters.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                    {activeFilters.map(filter => (
                                        <button
                                            key={filter.name}
                                            onClick={() => clearFilter(filter.name)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
                                        >
                                            <span className="opacity-60">{filter.label}:</span>
                                            <span>{filter.value}</span>
                                            <span className="opacity-50 hover:opacity-100 font-bold ml-0.5">×</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeFilters.length > 1 && (
                                <button
                                    onClick={clearAllFilters}
                                    className="text-xs shrink-0 hover:opacity-80 transition-opacity"
                                    style={{ color: 'var(--p-color-contrast-low)' }}
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        {/* Collapsible form */}
                        {filterPanelOpen && (
                            <div className="border-t border-white/10 px-4 pb-4 pt-4">
                                {/* Month pills */}
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--p-color-contrast-medium)' }}>BROWSE BY MONTH</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                            const isSelected = searchParams.month === m.toString();
                                            return (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => isSelected ? clearFilter('month') : setMonthFilter(m)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                                                        isSelected
                                                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                                            : 'border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300'
                                                    }`}
                                                    style={!isSelected ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                                                >
                                                    {new Date(2000, m - 1).toLocaleString('default', { month: 'short' })}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Song search */}
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold mb-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>FIND SHOWS BY SONG PLAYED</label>
                                    <p className="text-xs mb-2" style={{ color: 'var(--p-color-contrast-low)' }}>Find every show where a specific song was performed</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Originals</label>
                                            <select name="song" value={searchParams.song} onChange={handleInputChange} className={selectClass}
                                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                                <option value="">Select an original…</option>
                                                {originalsByAlbum.map(album => (
                                                    <optgroup key={album.name} label={album.name}>
                                                        {album.songs.map(title => (
                                                            <option key={title} value={title}>{title}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Covers</label>
                                            <select name="song" value={searchParams.song} onChange={handleInputChange} className={selectClass}
                                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                                <option value="">Select a cover…</option>
                                                {coverSongs.map(title => (
                                                    <option key={title} value={title}>{title}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Sunday Valley</label>
                                            <select name="song" value={searchParams.song} onChange={handleInputChange} className={selectClass}
                                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                                <option value="">Select a Sunday Valley song…</option>
                                                {sundayValleySongs.map(title => (
                                                    <option key={title} value={title}>{title}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Location */}
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--p-color-contrast-medium)' }}>FILTER BY LOCATION</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>State</label>
                                            <select name="state" value={searchParams.state} onChange={handleInputChange} className={selectClass}
                                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                                <option value="">All States</option>
                                                {geoOptions.states.map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Country</label>
                                            <select name="country" value={searchParams.country} onChange={handleInputChange} className={selectClass}
                                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                                <option value="">All Countries</option>
                                                {geoOptions.countries.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--p-color-contrast-medium)' }}>ADDITIONAL FILTERS</label>
                                    <div className="flex flex-wrap gap-4">
                                        {[
                                            { name: 'hasNotes', label: 'Comments' },
                                            { name: 'hasPhotos', label: 'Photos' },
                                            { name: 'hasPoster', label: 'Poster' },
                                            { name: 'isCancelled', label: 'Canceled Shows' },
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
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6">
                            <PInlineNotification heading="Search error" description={error} state="error" dismissButton={false} />
                        </div>
                    )}

                    {/* Hero state — shown when no filters are active */}
                    {showHero && (
                        <>
                            {/* At least a screen tall, so the footer starts below the
                                fold and its move when this is replaced isn't counted. */}
                            {!heroReady && (
                                <div className="min-h-screen flex justify-center pt-16">
                                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading' }} />
                                </div>
                            )}
                            <div className={heroReady ? undefined : 'hidden'}>
                                <NextShowWidget onReady={() => markHeroReady('next')} />
                                <MostRecentShowWidget onReady={() => markHeroReady('recent')} />
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <TourStatsWidget tourName={recentTourName} onReady={() => markHeroReady('tour')} />
                                    <UpcomingShowsWidget onReady={() => markHeroReady('upcoming')} />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Results */}
                    {showResults && (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-8">
                            <div className="flex items-center gap-3 mb-6 flex-wrap">
                                <PHeading size="lg" tag="h2">
                                    Results {filteredResults.length > 0 && `(${filteredResults.length})`}
                                </PHeading>
                                {loading && <PSpinner size="small" aria={{ 'aria-label': 'Searching' }} />}
                                {filteredResults.length > 0 && (
                                    <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
                                        {['newest', 'oldest'].map(order => (
                                            <button
                                                key={order}
                                                onClick={() => setSortOrder(order)}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                                                    sortOrder === order
                                                        ? 'bg-amber-500/15 text-amber-300'
                                                        : 'hover:bg-white/5'
                                                }`}
                                                style={sortOrder !== order ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                                            >
                                                {order}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {filteredResults.length === 0 && !loading ? (
                                <PText color="contrast-medium">No shows found. Try adjusting your search criteria.</PText>
                            ) : (
                                <div className="space-y-2">
                                    {[...filteredResults].sort((a, b) =>
                                        sortOrder === 'newest'
                                            ? b.show_date.localeCompare(a.show_date)
                                            : a.show_date.localeCompare(b.show_date)
                                    ).map((show) => {
                                        const isAttended = attendanceMap[show.id] || false;
                                        const isLoading = attendanceLoading[show.id] || false;
                                        const hasNotes = contentMap[show.id]?.hasNotes || false;
                                        const hasPhotos = contentMap[show.id]?.hasPhotos || false;
                                        const hasPoster = contentMap[show.id]?.hasPoster || false;
                                        const tagCounts = tagCountsMap[show.id] || {};
                                        const openedFor = show.opened_for?.name;
                                        const hasVideo = show.links?.some(l => l.url?.includes('youtube.com') || l.url?.includes('youtu.be'));
                                        const hasLinks = show.links?.some(l => l.url && !l.url.includes('youtube.com') && !l.url.includes('youtu.be'));
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
                                                {/* Date + content — single clickable link */}
                                                <Link to={buildShowPath(show)} className="flex flex-1 min-w-0">
                                                    {/* Date column */}
                                                    <div className="shrink-0 flex flex-col items-center justify-center w-14 sm:w-16 py-4 bg-white/[0.02] border-r border-white/5">
                                                        <span className={`font-display font-bold text-xl sm:text-2xl leading-none ${show.is_cancelled ? 'text-red-400/70' : 'text-amber-400'}`}>
                                                            {dayNum}
                                                        </span>
                                                        <span className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                                            {monthStr}
                                                        </span>
                                                        <span className="text-[9px] mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                            {sy}
                                                        </span>
                                                    </div>

                                                    {/* Text content — left-aligned */}
                                                    <div className="flex-1 min-w-0 p-3 sm:p-4">
                                                        <p className="font-semibold text-sm text-left flex items-center flex-wrap gap-1.5" style={{ color: 'var(--p-color-primary)' }}>
                                                            {show.artist_name}
                                                            {show.is_cancelled && (
                                                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                                                    Canceled
                                                                </span>
                                                            )}
                                                        </p>
                                                        {show.venues && (
                                                            <>
                                                                <p className="text-xs mt-0.5 truncate text-left" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                                                    {show.venues.name}
                                                                </p>
                                                                <p className="text-xs text-left" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                                    {[show.venues.city, show.venues.state].filter(Boolean).join(', ')}
                                                                </p>
                                                            </>
                                                        )}
                                                        {show.tour_name && (
                                                            <p className="text-xs mt-0.5 italic text-left" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                                {show.tour_name}
                                                            </p>
                                                        )}
                                                        <ShowTagsRow
                                                            className="mt-2"
                                                            openedFor={openedFor}
                                                            hasVideo={hasVideo} hasLinks={hasLinks} hasNotes={hasNotes} hasPhotos={hasPhotos} hasPoster={hasPoster}
                                                            coverCount={tagCounts.coverCount} teaseCount={tagCounts.teaseCount} rareCount={tagCounts.rareCount}
                                                            tourDebutCount={tagCounts.tourDebutCount} liveDebutCount={tagCounts.liveDebutCount}
                                                        />
                                                    </div>
                                                </Link>

                                                {/* Attendance + admin actions — outside the link */}
                                                {(user || isEditorOrAdmin) && (
                                                    <div className="shrink-0 flex flex-col items-center justify-center px-3 border-l border-white/5 gap-1.5">
                                                        {user && !show.is_cancelled && (
                                                            <button
                                                                onClick={(e) => handleAttendanceToggle(show.id, e)}
                                                                disabled={isLoading}
                                                                // The visible label is hidden below sm, which would leave the button unnamed on phones.
                                                                aria-label={isAttended
                                                                    ? (isFutureShow ? 'Attending' : 'I Was There')
                                                                    : (isFutureShow ? 'Going?' : 'Attended?')}
                                                                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-semibold border transition-all ${
                                                                    isAttended
                                                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/18'
                                                                        : 'border-white/15 hover:border-white/25 hover:bg-white/5'
                                                                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                style={!isAttended ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                                                            >
                                                                {isLoading ? (
                                                                    <svg aria-hidden="true" className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                                                ) : (
                                                                    <svg aria-hidden="true" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>{isAttended ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />}</svg>
                                                                )}
                                                                <span className="hidden sm:inline">
                                                                    {isAttended
                                                                        ? (isFutureShow ? 'Attending' : 'I Was There')
                                                                        : (isFutureShow ? 'Going?' : 'Attended?')}
                                                                </span>
                                                            </button>
                                                        )}
                                                        {isEditorOrAdmin && (
                                                            <Link
                                                                to={`/admin/shows/edit/${show.id}`}
                                                                className="text-xs hover:opacity-80 transition-opacity"
                                                                style={{ color: 'var(--p-color-contrast-medium)' }}
                                                                onClick={e => e.stopPropagation()}
                                                            >
                                                                Edit
                                                            </Link>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
                <Suspense fallback={<div className="flex justify-center py-16"><PSpinner size="medium" aria={{ 'aria-label': 'Loading stats' }} /></div>}>
                    <SongStatsWidget />
                </Suspense>
            )}

            {/* My Shows Tab */}
            {activeTab === 'myshows' && (
                <Suspense fallback={<div className="flex justify-center py-16"><PSpinner size="medium" aria={{ 'aria-label': 'Loading your stats' }} /></div>}>
                    <UserStatsWidget />
                </Suspense>
            )}
        </div>
    );
}
