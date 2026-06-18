import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    PHeading, PText, PButtonPure, PTag, PSpinner,
    PInlineNotification, PDivider
} from '@porsche-design-system/components-react';
import { getShowBySlug, getTourRarity, getAdjacentShows, checkShowAttendance, markShowAttended, unmarkShowAttended } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import { useAuth } from '../contexts/AuthContext';
import NotesSection from '../components/NotesSection';
import PhotosSection from '../components/PhotosSection';
import PostersSection from '../components/PostersSection';
import SEO from '../components/SEO';

function getYouTubeId(url) {
    try {
        const u = new URL(url);
        if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
        if (u.hostname.includes('youtube.com')) {
            if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
            return u.searchParams.get('v');
        }
    } catch {}
    return null;
}

function RareBadge({ count, total, tourName }) {
    return (
        <div className="relative inline-flex group/rare">
            <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded cursor-default"
                style={{ background: 'rgba(192, 132, 252, 0.12)', color: '#c084fc' }}
            >
                <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.456A1 1 0 0112 2z" clipRule="evenodd" />
                </svg>
                Rare
            </span>
            <div className="pointer-events-none absolute z-50 left-0 top-full mt-1.5
                            opacity-0 scale-95
                            group-hover/rare:opacity-100 group-hover/rare:scale-100
                            transition-all duration-100
                            w-52 rounded-xl border border-white/10 bg-[#0e1117] shadow-xl p-3">
                <div className="text-xs font-semibold" style={{ color: '#c084fc' }}>Rare</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    Played {count} of {total} shows on {tourName}
                </div>
            </div>
        </div>
    );
}

function SongRow({ song, position, isChained, tourRarity }) {
    const tourCount = tourRarity?.total_shows > 0 && song.song_id
        ? tourRarity.song_counts[song.song_id]
        : undefined;
    const isRare = tourCount != null && tourCount / tourRarity.total_shows < 0.15;

    return (
        <li className={`flex gap-3 py-2 items-start ${isChained ? 'ml-10 pl-3 border-l-2 border-white/10' : ''}`}>
            <span className={`shrink-0 font-mono text-sm leading-relaxed ${isChained ? 'w-4 text-white/25' : 'w-6 text-right font-bold text-amber-400'}`}>
                {isChained ? '›' : position}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`text-sm leading-relaxed ${isChained ? '' : 'font-semibold'}`}
                        style={{ color: isChained ? 'var(--p-color-contrast-medium)' : 'var(--p-color-primary)' }}>
                        {song.title}
                    </span>
                    {song.performance_type === 'tease' && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                            tease
                        </span>
                    )}
                    {song.performance_type === 'partial' && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                            partial
                        </span>
                    )}
                    {song.is_original === false && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300">
                            cover
                        </span>
                    )}
                    {isRare && (
                        <RareBadge count={tourCount} total={tourRarity.total_shows} tourName={tourRarity.tour_name} />
                    )}
                    {song.jams_into && (
                        <span className="font-bold text-amber-400 text-sm">→</span>
                    )}
                </div>
                {(song.original_artist || song.notes) && (
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {song.original_artist && <span>({song.original_artist})</span>}
                        {song.notes && <span className="italic">{song.notes}</span>}
                    </div>
                )}
            </div>
        </li>
    );
}

function SetList({ songs, tourRarity }) {
    return (
        <ol className="space-y-1">
            {songs.map((song, index) => {
                const isChained = index > 0 && songs[index - 1].jams_into != null;
                return (
                    <SongRow
                        key={song.id || index}
                        song={song}
                        position={index + 1}
                        isChained={isChained}
                        tourRarity={tourRarity}
                    />
                );
            })}
        </ol>
    );
}

export default function ShowDetailPage() {
    const { artist, date, locationSlug } = useParams();
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth();
    const [show, setShow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [attended, setAttended] = useState(false);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [songStats, setSongStats] = useState({ originals: 0, covers: 0 });
    const [tourRarity, setTourRarity] = useState(null);
    const [adjacent, setAdjacent] = useState({ prev: null, next: null });
    const initialLoad = useRef(true);

    useEffect(() => {
        const fetchShow = async () => {
            try {
                if (initialLoad.current) setLoading(true);
                setError(null);
                setAdjacent({ prev: null, next: null });
                setTourRarity(null);
                const data = await getShowBySlug(date, artist, locationSlug);
                setShow(data);
            } catch (err) {
                console.error('Error fetching show:', err);
                setError('Failed to load show details');
            } finally {
                setLoading(false);
                initialLoad.current = false;
            }
        };
        fetchShow();
    }, [artist, date, locationSlug]);

    // Redirect to canonical URL if params don't match (e.g. old links).
    // Guard: skip if show.show_date !== date — means show is stale from previous navigation.
    useEffect(() => {
        if (!show || show.show_date !== date) return;
        const canonical = buildShowPath(show);
        const current = `/show/${artist}/${date}/${locationSlug}`;
        if (current !== canonical) {
            navigate(canonical, { replace: true });
        }
    }, [show, artist, date, locationSlug, navigate]);

    // Calculate song stats when setlist loads
    useEffect(() => {
        if (!show?.setlist) {
            setSongStats({ originals: 0, covers: 0 });
            return;
        }
        const allSongs = [
            ...(show.setlist.set1 || []),
            ...(show.setlist.set2 || []),
            ...(show.setlist.set3 || []),
            ...(show.setlist.encore || [])
        ];
        const seen = new Set();
        let originals = 0, covers = 0;
        allSongs.forEach(song => {
            if (!song.song_id || seen.has(song.song_id)) return;
            seen.add(song.song_id);
            if (song.is_original === true) originals++;
            else covers++;
        });
        setSongStats({ originals, covers });
    }, [show]);

    // Fetch tour rarity data once show is loaded and has a tour
    useEffect(() => {
        if (!show?.id || !show?.tour_name) return;
        getTourRarity(show.id)
            .then(data => setTourRarity(data))
            .catch(err => console.error('[ShowDetail] tour rarity fetch failed:', err));
    }, [show?.id, show?.tour_name]);

    // Fetch previous/next show
    useEffect(() => {
        if (!show?.id) return;
        getAdjacentShows(show.id)
            .then(data => setAdjacent(data))
            .catch(err => console.error('[ShowDetail] adjacent shows fetch failed:', err));
    }, [show?.id]);

    // Check attendance after show loads
    useEffect(() => {
        if (!user || !show?.id) return;
        const check = async () => {
            try {
                const { attended: isAttended } = await checkShowAttendance(show.id);
                setAttended(isAttended);
            } catch (err) {
                console.error('Error checking attendance:', err);
            }
        };
        check();
    }, [show?.id, user]);

    const handleAttendanceToggle = async () => {
        if (!user || !show) {
            alert('Please log in to mark shows as attended');
            return;
        }
        setAttendanceLoading(true);
        try {
            if (attended) {
                await unmarkShowAttended(show.id);
                setAttended(false);
            } else {
                await markShowAttended(show.id);
                setAttended(true);
            }
        } catch (err) {
            console.error('Error toggling attendance:', err);
            alert(err.message || 'Failed to update attendance');
        } finally {
            setAttendanceLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <PSpinner size="large" aria={{ 'aria-label': 'Loading show details' }} />
            </div>
        );
    }

    if (error || !show) {
        return (
            <div className="px-4 py-8 max-w-4xl mx-auto space-y-4">
                <PInlineNotification
                    heading="Could not load show"
                    description={error || 'Show not found'}
                    state="error"
                    dismissButton={false}
                />
                <PButtonPure icon="arrow-left" onClick={() => navigate('/')}>
                    Back to Search
                </PButtonPure>
            </div>
        );
    }

    const formatDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        return new Date(year, month - 1, day).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    const venueName = show.venues?.name || '';
    const venueCity = show.venues
        ? `${show.venues.city}${show.venues.state_country ? ', ' + show.venues.state_country : ''}`
        : '';
    const [syear, smonth, sday] = show.show_date.split('-');
    const showDateObj = new Date(syear, smonth - 1, sday);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isFutureShow = showDateObj >= today;
    const longDate = showDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const seoTitle = `${show.artist_name} at ${venueName} – ${longDate} Setlist`;
    const allSongsFlat = [
        ...(show.setlist?.set1 || []),
        ...(show.setlist?.set2 || []),
        ...(show.setlist?.set3 || []),
        ...(show.setlist?.encore || []),
    ];
    const firstFive = allSongsFlat.slice(0, 5).map(s => s.title).filter(Boolean).join(', ');
    const seoDescription = `${show.artist_name} performed at ${venueName} in ${venueCity} on ${longDate}.${firstFive ? ' Setlist: ' + firstFive + '.' : ''}`;
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'MusicEvent',
        name: `${show.artist_name} – ${venueName}`,
        startDate: show.show_date,
        location: {
            '@type': 'MusicVenue',
            name: venueName,
            address: { '@type': 'PostalAddress', addressLocality: show.venues?.city, addressRegion: show.venues?.state_country }
        },
        performer: { '@type': 'MusicGroup', name: show.artist_name },
        ...(show.tour_name ? { subEvent: { '@type': 'Event', name: show.tour_name } } : {})
    };

    const attendanceLabel = attended
        ? (isFutureShow ? "I'm Attending" : 'I Was There')
        : (isFutureShow ? 'Mark as Attending' : 'Mark as Attended');
    const attendanceIcon = attended ? 'check' : 'plus';

    const sets = [
        { key: 'set1', label: 'Set 1' },
        { key: 'set2', label: 'Set 2' },
        { key: 'set3', label: 'Set 3' },
        { key: 'encore', label: 'Encore' },
    ].filter(({ key }) => show.setlist?.[key]?.length);

    return (
        <div className="px-4 py-8 max-w-4xl mx-auto space-y-6">
            <SEO title={seoTitle} description={seoDescription} jsonLd={jsonLd} />

            {/* Back navigation */}
            <PButtonPure icon="arrow-left" onClick={() => navigate('/')}>
                Back to Search
            </PButtonPure>

            {/* Prev / Next show navigation */}
            {(adjacent.prev || adjacent.next) && (
                <div className="flex items-center justify-between gap-4">
                    {adjacent.prev ? (
                        <button
                            onClick={() => navigate(buildShowPath(adjacent.prev))}
                            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>
                                <span className="block text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>Previous Show</span>
                                <span>{new Date(adjacent.prev.show_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </span>
                        </button>
                    ) : <div />}
                    {adjacent.next ? (
                        <button
                            onClick={() => navigate(buildShowPath(adjacent.next))}
                            className="flex items-center gap-2 text-sm text-right transition-opacity hover:opacity-80"
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                        >
                            <span>
                                <span className="block text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>Next Show</span>
                                <span>{new Date(adjacent.next.show_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </span>
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : <div />}
                </div>
            )}

            {/* Show header */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-8">
                {/* Artist name + attendance button */}
                <div className="flex items-start justify-between gap-4">
                    <h1 className="font-display font-bold text-2xl md:text-4xl leading-tight" style={{ color: 'var(--p-color-primary)' }}>
                        {show.artist_name}
                    </h1>
                    <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && (
                        <button
                            onClick={() => navigate(`/admin/shows/edit/${show.id}`)}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all"
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                        </button>
                    )}
                    {user && (
                        <button
                            onClick={handleAttendanceToggle}
                            disabled={attendanceLoading}
                            className={`shrink-0 inline-flex items-center gap-2 h-8 px-4 rounded-lg text-sm font-semibold border transition-all ${
                                attended
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/18'
                                    : 'border-white/15 hover:border-white/25 hover:bg-white/5'
                            } ${attendanceLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            style={!attended ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                        >
                            {attendanceLoading ? (
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{attended ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />}</svg>
                            )}
                            {attendanceLabel}
                        </button>
                    )}
                    </div>
                </div>

                {/* Date */}
                <div className="mt-5">
                    <div className="flex items-baseline gap-2.5">
                        <span className="font-display font-bold text-3xl leading-none text-amber-400">
                            {parseInt(sday, 10)}
                        </span>
                        <span className="font-semibold" style={{ color: 'var(--p-color-primary)' }}>
                            {showDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {showDateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                    </p>
                </div>

                {/* Venue */}
                {show.venues && (
                    <div className="mt-4">
                        <div className="font-semibold" style={{ color: 'var(--p-color-primary)' }}>
                            {show.venues.name}
                        </div>
                        <div className="text-sm mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            {venueCity}
                        </div>
                        {show.venues.address && (
                            <div className="text-xs mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>
                                {show.venues.address}
                            </div>
                        )}
                    </div>
                )}

                {/* Support act context */}
                {(show.opened_for || show.opening_act) && (
                    <div className="mt-4 flex flex-col gap-1.5">
                        {show.opened_for && (
                            <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                <span style={{ color: 'var(--p-color-contrast-low)' }}>Opening for </span>
                                <span className="font-semibold" style={{ color: 'var(--p-color-primary)' }}>{show.opened_for.name}</span>
                            </p>
                        )}
                        {show.opening_act && (
                            <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                <span style={{ color: 'var(--p-color-contrast-low)' }}>Opening act </span>
                                <span className="font-semibold" style={{ color: 'var(--p-color-primary)' }}>{show.opening_act.name}</span>
                            </p>
                        )}
                    </div>
                )}

                {/* Tags + Sources */}
                {(show.tour_name || songStats.originals > 0 || songStats.covers > 0 || show.source_types?.length > 0) && (
                    <div className="mt-5 pt-4 border-t border-white/[0.07] flex flex-wrap items-center gap-2">
                        {show.tour_name && <PTag>{show.tour_name}</PTag>}
                        {songStats.originals > 0 && (
                            <PTag color="notification-success-soft">
                                {songStats.originals} Original{songStats.originals !== 1 ? 's' : ''}
                            </PTag>
                        )}
                        {songStats.covers > 0 && (
                            <PTag color="notification-info-soft">
                                {songStats.covers} Cover{songStats.covers !== 1 ? 's' : ''}
                            </PTag>
                        )}
                        {show.source_types?.map((source, i) => <PTag key={i}>{source}</PTag>)}
                    </div>
                )}

                {/* Notes */}
                {show.notes && (
                    <div className="mt-5 pt-4 border-t border-white/[0.07]">
                        <PText size="small" color="contrast-medium">{show.notes}</PText>
                    </div>
                )}
            </div>

            {/* Setlist */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                <div className="flex items-baseline justify-between mb-1">
                    <PHeading size="large" tag="h2">Setlist</PHeading>
                    {sets.length > 0 && (
                        <span className="text-xs font-display" style={{ color: 'var(--p-color-contrast-low)' }}>
                            {[...(show.setlist?.set1||[]), ...(show.setlist?.set2||[]), ...(show.setlist?.set3||[]), ...(show.setlist?.encore||[])].length} songs
                        </span>
                    )}
                </div>

                {/* Compact legend */}
                <div className="mt-2 mb-6 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                    <span>
                        <span className="inline bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded font-bold uppercase tracking-wide text-[9px] mr-1">tease</span>
                        brief snippet
                    </span>
                    <span>
                        <span className="inline bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded font-bold uppercase tracking-wide text-[9px] mr-1">partial</span>
                        incomplete
                    </span>
                    <span><span className="font-bold text-amber-400 mr-0.5">→</span> segues into next</span>
                    <span><span className="inline-block w-px h-3 bg-white/20 mr-1 align-middle" />played inside another song</span>
                    {tourRarity?.tour_name && (
                        <span className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'rgba(192, 132, 252, 0.12)', color: '#c084fc' }}>
                                <svg className="w-2 h-2 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.456A1 1 0 0112 2z" clipRule="evenodd" /></svg>
                                Rare
                            </span>
                            played &lt;15% of tour shows
                        </span>
                    )}
                </div>

                {sets.length > 0 ? (
                    <div className="space-y-8">
                        {sets.map(({ key, label }, idx) => (
                            <div key={key}>
                                {idx > 0 && <div className="mb-6"><PDivider /></div>}
                                <div className="flex items-baseline gap-3 mb-3">
                                    <span className="text-xs font-bold font-display uppercase tracking-widest text-amber-400">
                                        {label}
                                    </span>
                                    <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                        {show.setlist[key].length} song{show.setlist[key].length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <SetList songs={show.setlist[key]} tourRarity={tourRarity} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <PText color="contrast-medium">No setlist information available for this show.</PText>
                )}
            </div>

            {/* Videos & Links */}
            {show.links?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                    <PHeading size="large" tag="h2">Videos &amp; Links</PHeading>
                    <div className="mt-6 space-y-8">
                        {show.links.map((link, i) => {
                            const ytId = getYouTubeId(link.url);
                            return ytId ? (
                                <div key={i}>
                                    {link.description && (
                                        <p className="text-sm mb-3" style={{ color: 'var(--p-color-contrast-medium)' }}>{link.description}</p>
                                    )}
                                    <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: '56.25%' }}>
                                        <iframe
                                            className="absolute inset-0 w-full h-full"
                                            src={`https://www.youtube.com/embed/${ytId}`}
                                            title={link.description || 'YouTube video'}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                </div>
                            ) : (
                                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-amber-400 hover:underline break-all">
                                    <span className="shrink-0">→</span>
                                    <span>{link.description || link.url}</span>
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Notes, Posters, Photos */}
            <NotesSection showId={show.id} />
            <PostersSection showId={show.id} />
            <PhotosSection showId={show.id} />

            {/* Bottom back link */}
            <PButtonPure icon="arrow-left" onClick={() => navigate('/')}>
                Back to Search
            </PButtonPure>
        </div>
    );
}
