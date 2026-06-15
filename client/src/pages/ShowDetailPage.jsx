import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    PHeading, PText, PButton, PButtonPure, PTag, PSpinner,
    PInlineNotification, PDivider
} from '@porsche-design-system/components-react';
import { getShowBySlug, checkShowAttendance, markShowAttended, unmarkShowAttended } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import { useAuth } from '../contexts/AuthContext';
import NotesSection from '../components/NotesSection';
import PhotosSection from '../components/PhotosSection';
import PostersSection from '../components/PostersSection';
import SEO from '../components/SEO';

function SongRow({ song, position, isChained }) {
    return (
        <li className={`flex gap-3 py-2 ${isChained ? 'ml-10 pl-3 border-l-2 border-white/10' : ''}`}>
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

function SetList({ songs }) {
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
                    />
                );
            })}
        </ol>
    );
}

export default function ShowDetailPage() {
    const { artist, date, locationSlug } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [show, setShow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [attended, setAttended] = useState(false);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [songStats, setSongStats] = useState({ originals: 0, covers: 0 });

    useEffect(() => {
        const fetchShow = async () => {
            try {
                setLoading(true);
                const data = await getShowBySlug(date, artist, locationSlug);
                setShow(data);
            } catch (err) {
                console.error('Error fetching show:', err);
                setError('Failed to load show details');
            } finally {
                setLoading(false);
            }
        };
        fetchShow();
    }, [artist, date, locationSlug]);

    // Redirect to canonical URL if params don't match (e.g. old links)
    useEffect(() => {
        if (!show) return;
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

            {/* Show header */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] overflow-hidden">
                {/* Artist name — full-width banner */}
                <div className="px-6 md:px-10 pt-8 pb-6">
                    <h1 className="font-display font-bold text-3xl md:text-5xl leading-tight" style={{ color: 'var(--p-color-primary)' }}>
                        {show.artist_name}
                    </h1>
                </div>

                {/* Two-column body */}
                <div className="border-t border-white/10 px-6 md:px-10 py-6 grid md:grid-cols-[1fr_auto] gap-8 items-start">
                    {/* Left: Date + Venue + Tags */}
                    <div className="space-y-4">
                        <div className="flex items-end gap-4">
                            <span className="font-display font-bold text-6xl leading-none text-amber-400">
                                {parseInt(sday, 10)}
                            </span>
                            <div className="pb-1.5">
                                <div className="font-semibold text-base leading-tight" style={{ color: 'var(--p-color-primary)' }}>
                                    {showDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </div>
                                <div className="text-sm mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    {showDateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                                </div>
                            </div>
                        </div>

                        {show.venues && (
                            <div>
                                <div className="font-semibold" style={{ color: 'var(--p-color-primary)' }}>
                                    {show.venues.name}
                                </div>
                                <div className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    {venueCity}
                                </div>
                                {show.venues.address && (
                                    <div className="text-xs mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>
                                        {show.venues.address}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
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
                        </div>
                    </div>

                    {/* Right: Attendance + Sources */}
                    <div className="flex flex-col gap-4 md:items-end">
                        {user && (
                            <PButton
                                variant={attended ? 'primary' : 'secondary'}
                                icon={attendanceIcon}
                                loading={attendanceLoading}
                                onClick={handleAttendanceToggle}
                            >
                                {attendanceLabel}
                            </PButton>
                        )}

                        {show.source_types?.length > 0 && (
                            <div className="md:text-right">
                                <div className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--p-color-contrast-low)' }}>
                                    Sources
                                </div>
                                <div className="flex flex-wrap gap-1 md:justify-end">
                                    {show.source_types.map((source, i) => (
                                        <PTag key={i}>{source}</PTag>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {show.notes && (
                    <div className="border-t border-white/10 px-6 md:px-10 py-4">
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
                                <SetList songs={show.setlist[key]} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <PText color="contrast-medium">No setlist information available for this show.</PText>
                )}
            </div>

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
