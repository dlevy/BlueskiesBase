import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getShows, searchShows, deleteShow } from '../../services/api';
import { buildShowPath } from '../../utils/showSlug';
import { supabase } from '../../services/supabase';

const selectClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent";

const EMPTY_FILTERS = { year: '', month: '', song: '', hasNotes: false, hasPhotos: false, hasPoster: false };
const hasActiveFilters = (f) => f.year || f.month || f.song || f.hasNotes || f.hasPhotos || f.hasPoster;

// Default landing view: shows dated within the last RECENT_DAYS days, up
// through today — deliberately excludes shows pre-entered ahead of their
// actual date, since those shouldn't clutter the view until show day.
const RECENT_DAYS = 14;
function getRecentRange() {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const from = new Date(today);
    from.setDate(from.getDate() - RECENT_DAYS);
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: todayStr };
}

export default function ShowsList() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [shows, setShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState(null);

    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [viewMode, setViewMode] = useState('recent'); // 'recent' | 'all'
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [years, setYears] = useState([]);
    const [originalsByAlbum, setOriginalsByAlbum] = useState([]);
    const [coverSongs, setCoverSongs] = useState([]);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const filtering = hasActiveFilters(filters);

    // Dropdown options for the year pills and song filter — same source data
    // as the public search page's advanced filters.
    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const { data: showsData } = await supabase
                    .from('shows')
                    .select('show_date');
                if (showsData) {
                    setYears([...new Set(showsData.map(s => parseInt(s.show_date.split('-')[0])))].sort((a, b) => b - a));
                }

                const { data: songsData } = await supabase
                    .from('songs')
                    .select('id, title, is_original, album_songs(album_id, track_order, albums(id, title, release_date))')
                    .order('title');
                if (songsData?.length > 0) {
                    setCoverSongs(
                        songsData.filter(s => s.is_original === false)
                            .sort((a, b) => a.title.localeCompare(b.title))
                            .map(s => s.title)
                    );

                    const albumMap = new Map();
                    songsData.filter(s => s.is_original === true).forEach(song => {
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
                }
            } catch (err) {
                console.error('[ShowsList] Error fetching filter options:', err);
            }
        };
        fetchFilterOptions();
    }, []);

    const fetchShows = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            if (hasActiveFilters(filters)) {
                const data = await searchShows(filters);
                setShows(data.shows || []);
                setPagination(null);
            } else {
                const data = await getShows(page, 20, viewMode === 'recent' ? getRecentRange() : {});
                setShows(data.shows || []);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error('[ShowsList] Error fetching shows:', err);
            setError('Failed to load shows');
        } finally {
            setLoading(false);
        }
    }, [page, filters, viewMode]);

    useEffect(() => {
        fetchShows();
    }, [fetchShows]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFilters(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const setYearFilter = (year) => setFilters(prev => ({ ...prev, year: year.toString() }));
    const setMonthFilter = (month) => setFilters(prev => ({ ...prev, month: month.toString() }));

    const clearFilter = (filterName) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: ['hasNotes', 'hasPhotos', 'hasPoster'].includes(filterName) ? false : '',
        }));
    };

    const clearAllFilters = () => setFilters(EMPTY_FILTERS);

    const activeFilters = [
        filters.year && { name: 'year', label: 'Year', value: filters.year },
        filters.month && { name: 'month', label: 'Month', value: new Date(2000, filters.month - 1).toLocaleString('default', { month: 'long' }) },
        filters.song && { name: 'song', label: 'Song', value: filters.song },
        filters.hasNotes && { name: 'hasNotes', label: 'Has Notes', value: 'Yes' },
        filters.hasPhotos && { name: 'hasPhotos', label: 'Has Photos', value: 'Yes' },
        filters.hasPoster && { name: 'hasPoster', label: 'Has Poster', value: 'Yes' },
    ].filter(Boolean);

    const handleDelete = async (id, showDate, artistName) => {
        if (!confirm(`Are you sure you want to delete the show on ${showDate} by ${artistName}?`)) return;
        try {
            await deleteShow(id);
            fetchShows();
        } catch (err) {
            console.error('Error deleting show:', err);
            alert('Failed to delete show');
        }
    };

    const formatDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (loading && shows.length === 0) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PHeading size="2xl" tag="h1">Manage Shows</PHeading>
                <Link to="/admin/shows/new">
                    <PButton>+ Add New Show</PButton>
                </Link>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            {!filtering && (
                <div className="flex items-center gap-2">
                    {[
                        { key: 'recent', label: `Recent (last ${RECENT_DAYS} days)` },
                        { key: 'all', label: 'All Shows' },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => { setViewMode(key); setSearchParams({ page: '1' }); }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                                viewMode === key
                                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                    : 'border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300'
                            }`}
                            style={viewMode !== key ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {/* Browse by year */}
            {years.length > 0 && (
                <div className="rounded-2xl border border-white/10 px-5 py-4" style={{ background: 'var(--p-color-surface)' }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--p-color-contrast-low)' }}>
                        Browse by year
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {years.map(year => (
                            <button
                                key={year}
                                onClick={() => filters.year === year.toString() ? clearFilter('year') : setYearFilter(year)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                                    filters.year === year.toString()
                                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                        : 'border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300'
                                }`}
                                style={filters.year !== year.toString() ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                            >
                                {year}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter bar */}
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'var(--p-color-surface)' }}>
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
                        <svg
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

                {filterPanelOpen && (
                    <div className="border-t border-white/10 px-4 pb-4 pt-4">
                        {/* Month pills */}
                        <div className="mb-4">
                            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--p-color-contrast-medium)' }}>BROWSE BY MONTH</label>
                            <div className="flex flex-wrap gap-1.5">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                    const isSelected = filters.month === m.toString();
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Originals</label>
                                    <select name="song" value={filters.song} onChange={handleInputChange} className={selectClass}
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
                                    <select name="song" value={filters.song} onChange={handleInputChange} className={selectClass}
                                        style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                        <option value="">Select a cover…</option>
                                        {coverSongs.map(title => (
                                            <option key={title} value={title}>{title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--p-color-contrast-medium)' }}>FILTER BY CONTENT</label>
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
                                            checked={filters[name]}
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

            {filtering && (
                <PText size="small" color="contrast-medium">
                    {shows.length} show{shows.length !== 1 ? 's' : ''} match{shows.length === 1 ? 'es' : ''} the current filters
                </PText>
            )}

            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'var(--p-color-surface)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-white/10" style={{ background: 'var(--p-color-canvas)' }}>
                            <tr>
                                {['Date', 'Artist', 'Venue', 'Tour', 'Actions'].map((h, i) => (
                                    <th key={h}
                                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}
                                        style={{ color: 'var(--p-color-contrast-medium)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {shows.map((show) => (
                                <tr key={show.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <PText size="small">{formatDate(show.show_date)}</PText>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <PText size="small" weight="semi-bold">{show.artist_name}</PText>
                                    </td>
                                    <td className="px-4 py-3">
                                        {show.venues ? (
                                            <div>
                                                <PText size="small">{show.venues.name}</PText>
                                                <PText size="x-small" color="contrast-medium">
                                                    {show.venues.city}, {show.venues.state_country}
                                                </PText>
                                            </div>
                                        ) : (
                                            <PText size="small" color="contrast-medium">No venue</PText>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <PText size="small" color="contrast-medium">{show.tour_name || '-'}</PText>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <Link to={buildShowPath(show)} target="_blank">
                                                <PButtonPure size="x-small">View</PButtonPure>
                                            </Link>
                                            <Link to={`/admin/shows/edit/${show.id}`}>
                                                <PButtonPure size="x-small">Edit</PButtonPure>
                                            </Link>
                                            <Link to={`/admin/shows/${show.id}/instagram`}>
                                                <PButtonPure size="x-small">IG Post</PButtonPure>
                                            </Link>
                                            <PButtonPure size="x-small"
                                                onClick={() => handleDelete(show.id, formatDate(show.show_date), show.artist_name)}
                                                style={{ color: 'var(--p-color-error)' }}>
                                                Delete
                                            </PButtonPure>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {shows.length === 0 && !loading && (
                        <div className="text-center py-8">
                            <PText color="contrast-medium">
                                {!filtering && viewMode === 'recent'
                                    ? `No shows in the last ${RECENT_DAYS} days.`
                                    : 'No shows found. Add your first show!'}
                            </PText>
                            {!filtering && viewMode === 'recent' && (
                                <PButtonPure size="small" onClick={() => { setViewMode('all'); setSearchParams({ page: '1' }); }} className="mt-1">
                                    View All Shows
                                </PButtonPure>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-4">
                    <PButton variant="secondary" size="small"
                        disabled={page === 1}
                        onClick={() => setSearchParams({ page: (page - 1).toString() })}>
                        Previous
                    </PButton>
                    <PText size="small" color="contrast-medium">
                        Page {page} of {pagination.totalPages}
                    </PText>
                    <PButton variant="secondary" size="small"
                        disabled={page === pagination.totalPages}
                        onClick={() => setSearchParams({ page: (page + 1).toString() })}>
                        Next
                    </PButton>
                </div>
            )}
        </div>
    );
}
