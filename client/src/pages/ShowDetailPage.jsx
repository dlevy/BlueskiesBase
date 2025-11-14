import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getShowById, checkShowAttendance, markShowAttended, unmarkShowAttended } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import NotesSection from '../components/NotesSection';
import PhotosSection from '../components/PhotosSection';
import PostersSection from '../components/PostersSection';

export default function ShowDetailPage() {
    const { id } = useParams();
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
                const data = await getShowById(id);
                setShow(data);
            } catch (err) {
                console.error('Error fetching show:', err);
                setError('Failed to load show details');
            } finally {
                setLoading(false);
            }
        };

        fetchShow();
    }, [id]);

    // Calculate song statistics when show data loads
    useEffect(() => {
        if (!show || !show.setlist) {
            setSongStats({ originals: 0, covers: 0 });
            return;
        }

        // Collect all songs from all sets
        const allSongs = [
            ...(show.setlist.set1 || []),
            ...(show.setlist.set2 || []),
            ...(show.setlist.set3 || []),
            ...(show.setlist.encore || [])
        ];

        // Track unique songs by song_id
        const uniqueSongIds = new Set();
        let originals = 0;
        let covers = 0;

        allSongs.forEach(song => {
            const songId = song.song_id;
            if (!songId || uniqueSongIds.has(songId)) {
                return; // Skip if no song_id or already counted
            }

            uniqueSongIds.add(songId);

            // Use ONLY songs.is_original as master source of truth
            const isOriginal = song.is_original === true;

            if (isOriginal) {
                originals++;
            } else {
                covers++;
            }
        });

        setSongStats({ originals, covers });
    }, [show]);

    useEffect(() => {
        const checkAttendance = async () => {
            if (user && id) {
                try {
                    const { attended: isAttended } = await checkShowAttendance(id);
                    setAttended(isAttended);
                } catch (err) {
                    console.error('Error checking attendance:', err);
                }
            }
        };

        checkAttendance();
    }, [id, user]);

    const handleAttendanceToggle = async () => {
        if (!user) {
            alert('Please log in to mark shows as attended');
            return;
        }

        setAttendanceLoading(true);
        try {
            if (attended) {
                await unmarkShowAttended(id);
                setAttended(false);
            } else {
                await markShowAttended(id);
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
            <div className="px-4 py-8 max-w-6xl mx-auto">
                <div className="text-center">
                    <div className="text-xl text-gray-300">Loading...</div>
                </div>
            </div>
        );
    }

    if (error || !show) {
        return (
            <div className="px-4 py-8 max-w-6xl mx-auto">
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                    {error || 'Show not found'}
                </div>
                <Link to="/" className="text-blue-400 hover:text-blue-300 mt-4 inline-block transition-colors">
                    ← Back to Search
                </Link>
            </div>
        );
    }

    const formatDate = (dateString) => {
        // Parse date as local date to avoid timezone issues
        // Date string format: "YYYY-MM-DD"
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="px-4 py-8 max-w-6xl mx-auto">
            {/* Back Button */}
            <Link to="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block transition-colors">
                ← Back to Search
            </Link>

            {/* Show Header */}
            <div className="bg-gray-800 shadow-2xl rounded-lg p-4 md:p-6 mb-6 border border-gray-700 relative text-center">
                {/* Attendance Button - responsive positioning */}
                {user && (
                    <div className="absolute top-2 right-2 md:top-6 md:right-6">
                        <button
                            onClick={handleAttendanceToggle}
                            disabled={attendanceLoading}
                            className={`px-3 py-2 md:px-6 md:py-3 rounded-lg font-medium text-xs md:text-base transition-all whitespace-nowrap ${
                                attended
                                    ? 'bg-green-900/50 text-green-200 border-2 border-green-700 hover:bg-green-900/70'
                                    : 'bg-blue-900/50 text-blue-200 border-2 border-blue-700 hover:bg-blue-900/70'
                            } disabled:opacity-50`}
                        >
                            {attendanceLoading ? '...' : attended ? '✓' : '+'}
                            <span className="hidden sm:inline ml-1">{attended ? 'I Was There' : 'Mark as Attended'}</span>
                        </button>
                    </div>
                )}

                {/* Centered content - add padding on mobile to avoid button overlap */}
                <div className={user ? 'pr-20 md:pr-0' : ''}>
                    <h1 className="text-2xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{show.artist_name}</h1>
                    <p className="text-lg md:text-2xl text-gray-300 mb-2">{formatDate(show.show_date)}</p>

                    {show.venues && (
                        <div className="text-sm md:text-lg text-gray-400 mb-2">
                            <p className="font-semibold text-gray-200">{show.venues.name}</p>
                            <p>{show.venues.city}, {show.venues.state_country}</p>
                            {show.venues.address && (
                                <p className="text-xs md:text-sm">{show.venues.address}</p>
                            )}
                        </div>
                    )}

                    {show.tour_name && (
                        <p className="text-sm md:text-lg italic text-gray-400 mb-2">
                            Tour: {show.tour_name}
                        </p>
                    )}

                    {/* Song Stats Badges */}
                    {(songStats.originals > 0 || songStats.covers > 0) && (
                        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
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
                </div>

                {/* Source Types */}
                {show.source_types && show.source_types.length > 0 && (
                    <div className="mt-4">
                        <span className="font-semibold text-gray-300">Available Sources: </span>
                        {show.source_types.map((source, index) => (
                            <span
                                key={index}
                                className="inline-block bg-blue-900/50 text-blue-200 px-3 py-1 rounded-full text-sm mr-2 mb-2 border border-blue-700"
                            >
                                {source}
                            </span>
                        ))}
                    </div>
                )}

                {show.has_images && (
                    <div className="mt-2">
                        <span className="inline-block bg-green-900/50 text-green-300 px-3 py-1 rounded-full text-sm border border-green-700">
                            📸 Has Images
                        </span>
                    </div>
                )}

                {show.notes && (
                    <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <p className="font-semibold text-gray-300 mb-2">Notes:</p>
                        <p className="text-gray-400">{show.notes}</p>
                    </div>
                )}
            </div>

            {/* Setlist */}
            <div className="bg-gray-800 shadow-2xl rounded-lg p-6 border border-gray-700 text-left">
                <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent text-left">Setlist</h2>

                {/* Legend */}
                <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700 text-sm text-gray-400">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded border border-yellow-700 whitespace-nowrap">
                                Tease
                            </span>
                            <span>= Brief snippet without full vocals</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded border border-orange-700 whitespace-nowrap">
                                Partial
                            </span>
                            <span>= Incomplete performance</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700 font-bold whitespace-nowrap">
                                &gt;
                            </span>
                            <span>= Jams into next song</span>
                        </div>
                    </div>
                </div>

                {show.setlist && Object.keys(show.setlist).length > 0 ? (
                    <div className="space-y-6 text-left">
                        {/* Set 1 */}
                        {show.setlist.set1 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-3 text-blue-400 text-left">Set 1</h3>
                                <ol className="space-y-3">
                                    {show.setlist.set1.map((song, index) => (
                                        <li key={index} className="flex gap-3 text-gray-200">
                                            {/* Song Number */}
                                            <span className="text-gray-500 font-mono text-sm mt-0.5 min-w-[2rem]">
                                                {index + 1}.
                                            </span>

                                            {/* Song Content */}
                                            <div className="flex-1">
                                                {/* First Line: Title + Badges */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium text-lg">{song.title}</span>

                                                    {/* Performance Type Badge */}
                                                    {song.performance_type === 'tease' && (
                                                        <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded border border-yellow-700 whitespace-nowrap">
                                                            Tease
                                                        </span>
                                                    )}
                                                    {song.performance_type === 'partial' && (
                                                        <span className="text-xs bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded border border-orange-700 whitespace-nowrap">
                                                            Partial
                                                        </span>
                                                    )}

                                                    {/* Only show Cover badge, Original is implied */}
                                                    {song.is_original === false && (
                                                        <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-700 whitespace-nowrap">
                                                            Cover
                                                        </span>
                                                    )}
                                                    {song.jams_into && (
                                                        <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700 font-bold whitespace-nowrap">
                                                            &gt;
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Second Line: Metadata (if any) */}
                                                {(song.original_artist || song.notes) && (
                                                    <div className="mt-1 text-sm space-x-2">
                                                        {song.original_artist && (
                                                            <span className="text-gray-400">
                                                                ({song.original_artist})
                                                            </span>
                                                        )}
                                                        {song.notes && (
                                                            <span className="text-gray-400 italic">
                                                                {song.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Set 2 */}
                        {show.setlist.set2 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-3 text-blue-400 text-left">Set 2</h3>
                                <ol className="space-y-3">
                                    {show.setlist.set2.map((song, index) => (
                                        <li key={index} className="flex gap-3 text-gray-200">
                                            {/* Song Number */}
                                            <span className="text-gray-500 font-mono text-sm mt-0.5 min-w-[2rem]">
                                                {index + 1}.
                                            </span>

                                            {/* Song Content */}
                                            <div className="flex-1">
                                                {/* First Line: Title + Badges */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium text-lg">{song.title}</span>

                                                    {/* Performance Type Badge */}
                                                    {song.performance_type === 'tease' && (
                                                        <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded border border-yellow-700 whitespace-nowrap">
                                                            Tease
                                                        </span>
                                                    )}
                                                    {song.performance_type === 'partial' && (
                                                        <span className="text-xs bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded border border-orange-700 whitespace-nowrap">
                                                            Partial
                                                        </span>
                                                    )}

                                                    {/* Only show Cover badge, Original is implied */}
                                                    {song.is_original === false && (
                                                        <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-700 whitespace-nowrap">
                                                            Cover
                                                        </span>
                                                    )}
                                                    {song.jams_into && (
                                                        <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700 font-bold whitespace-nowrap">
                                                            &gt;
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Second Line: Metadata (if any) */}
                                                {(song.original_artist || song.notes) && (
                                                    <div className="mt-1 text-sm space-x-2">
                                                        {song.original_artist && (
                                                            <span className="text-gray-400">
                                                                ({song.original_artist})
                                                            </span>
                                                        )}
                                                        {song.notes && (
                                                            <span className="text-gray-400 italic">
                                                                {song.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Set 3 */}
                        {show.setlist.set3 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-3 text-blue-400 text-left">Set 3</h3>
                                <ol className="space-y-3">
                                    {show.setlist.set3.map((song, index) => (
                                        <li key={index} className="flex gap-3 text-gray-200">
                                            {/* Song Number */}
                                            <span className="text-gray-500 font-mono text-sm mt-0.5 min-w-[2rem]">
                                                {index + 1}.
                                            </span>

                                            {/* Song Content */}
                                            <div className="flex-1">
                                                {/* First Line: Title + Badges */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium text-lg">{song.title}</span>

                                                    {/* Performance Type Badge */}
                                                    {song.performance_type === 'tease' && (
                                                        <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded border border-yellow-700 whitespace-nowrap">
                                                            Tease
                                                        </span>
                                                    )}
                                                    {song.performance_type === 'partial' && (
                                                        <span className="text-xs bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded border border-orange-700 whitespace-nowrap">
                                                            Partial
                                                        </span>
                                                    )}

                                                    {/* Only show Cover badge, Original is implied */}
                                                    {song.is_original === false && (
                                                        <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-700 whitespace-nowrap">
                                                            Cover
                                                        </span>
                                                    )}
                                                    {song.jams_into && (
                                                        <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700 font-bold whitespace-nowrap">
                                                            &gt;
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Second Line: Metadata (if any) */}
                                                {(song.original_artist || song.notes) && (
                                                    <div className="mt-1 text-sm space-x-2">
                                                        {song.original_artist && (
                                                            <span className="text-gray-400">
                                                                ({song.original_artist})
                                                            </span>
                                                        )}
                                                        {song.notes && (
                                                            <span className="text-gray-400 italic">
                                                                {song.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Encore */}
                        {show.setlist.encore && (
                            <div>
                                <h3 className="text-xl font-semibold mb-3 text-purple-400 text-left">Encore</h3>
                                <ol className="space-y-3">
                                    {show.setlist.encore.map((song, index) => (
                                        <li key={index} className="flex gap-3 text-gray-200">
                                            {/* Song Number */}
                                            <span className="text-gray-500 font-mono text-sm mt-0.5 min-w-[2rem]">
                                                {index + 1}.
                                            </span>

                                            {/* Song Content */}
                                            <div className="flex-1">
                                                {/* First Line: Title + Badges */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium text-lg">{song.title}</span>

                                                    {/* Performance Type Badge */}
                                                    {song.performance_type === 'tease' && (
                                                        <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded border border-yellow-700 whitespace-nowrap">
                                                            Tease
                                                        </span>
                                                    )}
                                                    {song.performance_type === 'partial' && (
                                                        <span className="text-xs bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded border border-orange-700 whitespace-nowrap">
                                                            Partial
                                                        </span>
                                                    )}

                                                    {/* Only show Cover badge, Original is implied */}
                                                    {song.is_original === false && (
                                                        <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-700 whitespace-nowrap">
                                                            Cover
                                                        </span>
                                                    )}
                                                    {song.jams_into && (
                                                        <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700 font-bold whitespace-nowrap">
                                                            &gt;
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Second Line: Metadata (if any) */}
                                                {(song.original_artist || song.notes) && (
                                                    <div className="mt-1 text-sm space-x-2">
                                                        {song.original_artist && (
                                                            <span className="text-gray-400">
                                                                ({song.original_artist})
                                                            </span>
                                                        )}
                                                        {song.notes && (
                                                            <span className="text-gray-400 italic">
                                                                {song.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-400">No setlist information available for this show.</p>
                )}
            </div>

            {/* Notes Section */}
            <div className="mt-8">
                <NotesSection showId={id} />
            </div>

            {/* Poster Section */}
            <div className="mt-8">
                <PostersSection showId={id} />
            </div>

            {/* Photos Section */}
            <div className="mt-8">
                <PhotosSection showId={id} />
            </div>

            {/* Back Button at Bottom */}
            <div className="mt-6">
                <Link to="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                    ← Back to Search
                </Link>
            </div>
        </div>
    );
}

