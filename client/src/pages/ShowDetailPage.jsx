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
        <li className={`flex gap-3 py-1.5 ${isChained ? 'ml-8 pl-3 border-l-2 border-gray-600' : ''}`}>
            <span className={`font-mono text-sm mt-0.5 shrink-0 text-gray-500 ${isChained ? 'w-4' : 'w-7 text-right'}`}>
                {isChained ? '›' : `${position}.`}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <PText size="medium" weight={isChained ? 'regular' : 'semi-bold'}>
                        {song.title}
                    </PText>
                    {song.performance_type === 'tease' && (
                        <PTag color="notification-warning-soft">Tease</PTag>
                    )}
                    {song.performance_type === 'partial' && (
                        <PTag color="notification-warning-soft">Partial</PTag>
                    )}
                    {song.is_original === false && (
                        <PTag color="notification-info-soft">Cover</PTag>
                    )}
                    {song.jams_into && (
                        <PTag color="primary">›</PTag>
                    )}
                </div>
                {(song.original_artist || song.notes) && (
                    <div className="mt-0.5 text-sm space-x-2">
                        {song.original_artist && (
                            <PText size="small" color="contrast-medium" tag="span">
                                ({song.original_artist})
                            </PText>
                        )}
                        {song.notes && (
                            <PText size="small" color="contrast-medium" tag="span">
                                <em>{song.notes}</em>
                            </PText>
                        )}
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
            <div className="relative rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                {/* Attendance button */}
                {user && (
                    <div className="absolute top-4 right-4 md:top-6 md:right-6">
                        <PButton
                            variant={attended ? 'primary' : 'secondary'}
                            icon={attendanceIcon}
                            loading={attendanceLoading}
                            onClick={handleAttendanceToggle}
                        >
                            <span className="hidden sm:inline">{attendanceLabel}</span>
                        </PButton>
                    </div>
                )}

                {/* Artist + show info */}
                <div className={`text-center ${user ? 'pr-14 md:pr-44' : ''}`}>
                    <PHeading size="xx-large" tag="h1" align="center">
                        {show.artist_name}
                    </PHeading>

                    <div className="mt-3">
                        <PText size="large" align="center" color="contrast-medium">
                            {formatDate(show.show_date)}
                        </PText>
                    </div>

                    {show.venues && (
                        <div className="mt-4">
                            <PText weight="semi-bold" align="center">{show.venues.name}</PText>
                            <PText color="contrast-medium" align="center">
                                {show.venues.city}{show.venues.state_country ? `, ${show.venues.state_country}` : ''}
                            </PText>
                            {show.venues.address && (
                                <PText size="small" color="contrast-medium" align="center">
                                    {show.venues.address}
                                </PText>
                            )}
                        </div>
                    )}

                    {show.tour_name && (
                        <div className="mt-4 flex justify-center">
                            <PTag>{show.tour_name}</PTag>
                        </div>
                    )}

                    {(songStats.originals > 0 || songStats.covers > 0) && (
                        <div className="mt-4 flex gap-2 justify-center flex-wrap">
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
                    )}

                    {show.source_types?.length > 0 && (
                        <div className="mt-5">
                            <PDivider />
                            <div className="mt-4 flex gap-2 justify-center flex-wrap items-center">
                                <PText size="small" color="contrast-medium">Sources:</PText>
                                {show.source_types.map((source, i) => (
                                    <PTag key={i}>{source}</PTag>
                                ))}
                            </div>
                        </div>
                    )}

                    {show.notes && (
                        <div className="mt-5">
                            <PDivider />
                            <div className="mt-4 text-left">
                                <PText size="small" color="contrast-medium">{show.notes}</PText>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Setlist */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                <PHeading size="large" tag="h2">Setlist</PHeading>

                {/* Legend */}
                <div className="mt-4 mb-6 flex flex-wrap gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2">
                        <PTag color="notification-warning-soft">Tease</PTag>
                        <PText size="x-small" color="contrast-low">Brief snippet without full vocals</PText>
                    </div>
                    <div className="flex items-center gap-2">
                        <PTag color="notification-warning-soft">Partial</PTag>
                        <PText size="x-small" color="contrast-low">Incomplete performance</PText>
                    </div>
                    <div className="flex items-center gap-2">
                        <PTag color="primary">›</PTag>
                        <PText size="x-small" color="contrast-low">Segues into next song</PText>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-px h-4 bg-gray-500 mr-1" />
                        <PText size="x-small" color="contrast-low">Played inside another song</PText>
                    </div>
                </div>

                {sets.length > 0 ? (
                    <div className="space-y-8">
                        {sets.map(({ key, label }, idx) => (
                            <div key={key}>
                                {idx > 0 && (
                                    <div className="mb-6">
                                        <PDivider />
                                    </div>
                                )}
                                <PHeading size="small" tag="h3">{label}</PHeading>
                                <div className="mt-3">
                                    <SetList songs={show.setlist[key]} />
                                </div>
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
