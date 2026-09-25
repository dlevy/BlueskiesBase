import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { supabase } from '../../services/supabase';
import { updateShowTour } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Fetches every row of `shows` (paginated, stable order) — the shows table is small
// enough that fetching once and filtering client-side (both "shows in this tour" and
// the add-shows search) is simpler and fast enough, matching the pattern already used
// elsewhere (SearchPage, TourStatsPage) rather than round-tripping per keystroke.
async function fetchAllShows() {
    let rows = [];
    for (let rangeStart = 0; ;) {
        const { data: page, error } = await supabase
            .from('shows')
            .select('id, show_date, artist_name, tour_name, venues(name, city, state_country)')
            .order('id')
            .range(rangeStart, rangeStart + 999);
        if (error) throw error;
        rows = rows.concat(page || []);
        if (!page || page.length < 1000) break;
        rangeStart += 1000;
    }
    return rows;
}

export default function TourEditPage() {
    const { tourName: encodedTourName } = useParams();
    const tourName = decodeURIComponent(encodedTourName);
    const navigate = useNavigate();
    const { getToken, isAdmin } = useAuth();

    const [allShows, setAllShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [renameValue, setRenameValue] = useState(tourName);
    const [renaming, setRenaming] = useState(false);
    const [renameError, setRenameError] = useState('');

    const [search, setSearch] = useState('');
    const [addingId, setAddingId] = useState(null);
    const [removingId, setRemovingId] = useState(null);

    const loadShows = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setAllShows(await fetchAllShows());
        } catch (err) {
            console.error('[TourEditPage] Error fetching shows:', err);
            setError('Failed to load shows');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadShows();
        setRenameValue(tourName);
        setSearch('');
    }, [tourName, loadShows]);

    const showsInTour = allShows
        .filter(s => s.tour_name === tourName)
        .sort((a, b) => a.show_date.localeCompare(b.show_date));

    const handleRename = async (e) => {
        e.preventDefault();
        const trimmed = renameValue.trim();
        if (!trimmed) { setRenameError('Tour name is required'); return; }
        if (trimmed === tourName) return;
        setRenaming(true);
        setRenameError('');
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/api/admin/tours/${encodeURIComponent(tourName)}/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ newName: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to rename tour');
            navigate(`/admin/tours/${encodeURIComponent(trimmed)}`, { replace: true });
        } catch (err) {
            setRenameError(err.message);
        } finally {
            setRenaming(false);
        }
    };

    const handleRemove = async (showId) => {
        setRemovingId(showId);
        try {
            await updateShowTour(showId, null);
            setAllShows(prev => prev.map(s => s.id === showId ? { ...s, tour_name: null } : s));
        } catch (err) {
            console.error('Error removing show from tour:', err);
            alert('Failed to remove show from tour');
        } finally {
            setRemovingId(null);
        }
    };

    const handleAdd = async (showId) => {
        setAddingId(showId);
        try {
            await updateShowTour(showId, tourName);
            setAllShows(prev => prev.map(s => s.id === showId ? { ...s, tour_name: tourName } : s));
        } catch (err) {
            console.error('Error adding show to tour:', err);
            alert('Failed to add show to tour');
        } finally {
            setAddingId(null);
        }
    };

    const searchTerm = search.trim().toLowerCase();
    const searchResults = searchTerm.length >= 2
        ? allShows
            .filter(s => s.tour_name !== tourName)
            .filter(s =>
                s.artist_name?.toLowerCase().includes(searchTerm)
                || s.venues?.name?.toLowerCase().includes(searchTerm)
                || s.venues?.city?.toLowerCase().includes(searchTerm)
                || s.show_date.includes(searchTerm)
            )
            .slice(0, 20)
        : [];

    if (loading) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    return (
        <div className="space-y-6">
            <PButtonPure icon="arrow-left" onClick={() => navigate('/admin/tours')}>
                Back to Tours
            </PButtonPure>

            <PHeading size="2xl" tag="h1">{tourName}</PHeading>

            {error && <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />}

            {/* Rename — admin only */}
            {isAdmin && (
                <div className="rounded-2xl border border-white/10 p-5 space-y-3" style={{ background: 'var(--p-color-surface)' }}>
                    <PHeading size="md" tag="h2">Rename Tour</PHeading>
                    {renameError && <PInlineNotification heading="Error" description={renameError} state="error" dismissButton={false} />}
                    <form onSubmit={handleRename} className="flex gap-2">
                        <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className={inputClass} />
                        <PButton type="submit" size="small" loading={renaming} disabled={!renameValue.trim() || renameValue.trim() === tourName}>
                            Rename
                        </PButton>
                    </form>
                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        Renaming updates every show currently in this tour, plus its Instagram post style.
                    </PText>
                </div>
            )}

            {/* Shows in tour */}
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'var(--p-color-surface)' }}>
                <div className="px-4 py-3 border-b border-white/10">
                    <PHeading size="md" tag="h2">Shows in This Tour ({showsInTour.length})</PHeading>
                </div>
                <div className="divide-y divide-white/5">
                    {showsInTour.map(show => (
                        <div key={show.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                                <PText size="small" weight="semi-bold">{formatDate(show.show_date)} — {show.artist_name}</PText>
                                {show.venues && (
                                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                        {show.venues.name} &middot; {show.venues.city}, {show.venues.state_country}
                                    </PText>
                                )}
                            </div>
                            <button
                                onClick={() => handleRemove(show.id)}
                                disabled={removingId === show.id}
                                className="text-xs px-3 py-1 rounded-lg border transition-all disabled:opacity-50 shrink-0"
                                style={{ border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
                            >
                                {removingId === show.id ? 'Removing…' : 'Remove'}
                            </button>
                        </div>
                    ))}
                    {showsInTour.length === 0 && (
                        <div className="text-center py-8">
                            <PText color="contrast-medium">No shows in this tour yet. Add some below.</PText>
                        </div>
                    )}
                </div>
            </div>

            {/* Add shows */}
            <div className="rounded-2xl border border-white/10 p-5 space-y-3" style={{ background: 'var(--p-color-surface)' }}>
                <PHeading size="md" tag="h2">Add Shows to This Tour</PHeading>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by artist, venue, city, or date (YYYY-MM-DD)…"
                    className={inputClass}
                />
                {searchResults.length > 0 && (
                    <div className="space-y-1.5">
                        {searchResults.map(show => (
                            <div key={show.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                                <div className="min-w-0">
                                    <PText size="small" weight="semi-bold">{formatDate(show.show_date)} — {show.artist_name}</PText>
                                    {show.venues && (
                                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                            {show.venues.name} &middot; {show.venues.city}, {show.venues.state_country}
                                            {show.tour_name && <> &middot; currently: {show.tour_name}</>}
                                        </PText>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleAdd(show.id)}
                                    disabled={addingId === show.id}
                                    className="text-xs px-3 py-1 rounded-lg border transition-all disabled:opacity-50 shrink-0"
                                    style={{ border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}
                                >
                                    {addingId === show.id ? 'Adding…' : 'Add'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {searchTerm.length >= 2 && searchResults.length === 0 && (
                    <PText size="xs" color="contrast-medium">No matching shows found.</PText>
                )}
            </div>
        </div>
    );
}
