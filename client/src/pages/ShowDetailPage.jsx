import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getShowById, checkShowAttendance, markShowAttended, unmarkShowAttended } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function ShowDetailPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const [show, setShow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [attended, setAttended] = useState(false);
    const [attendanceLoading, setAttendanceLoading] = useState(false);

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
        return new Date(dateString).toLocaleDateString('en-US', {
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
            <div className="bg-gray-800 shadow-2xl rounded-lg p-6 mb-6 border border-gray-700 relative text-center">
                {/* Attendance Button - positioned absolutely in top right */}
                {user && (
                    <div className="absolute top-6 right-6">
                        <button
                            onClick={handleAttendanceToggle}
                            disabled={attendanceLoading}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${
                                attended
                                    ? 'bg-green-900/50 text-green-200 border-2 border-green-700 hover:bg-green-900/70'
                                    : 'bg-blue-900/50 text-blue-200 border-2 border-blue-700 hover:bg-blue-900/70'
                            } disabled:opacity-50`}
                        >
                            {attendanceLoading ? '...' : attended ? '✓ I Was There' : '+ Mark as Attended'}
                        </button>
                    </div>
                )}

                {/* Centered content */}
                <div>
                    <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{show.artist_name}</h1>
                    <p className="text-2xl text-gray-300 mb-2">{formatDate(show.show_date)}</p>

                    {show.venues && (
                        <div className="text-lg text-gray-400 mb-2">
                            <p className="font-semibold text-gray-200">{show.venues.name}</p>
                            <p>{show.venues.city}, {show.venues.state_country}</p>
                            {show.venues.address && (
                                <p className="text-sm">{show.venues.address}</p>
                            )}
                        </div>
                    )}

                    {show.tour_name && (
                        <p className="text-lg italic text-gray-400 mb-2">
                            Tour: {show.tour_name}
                        </p>
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
            <div className="bg-gray-800 shadow-2xl rounded-lg p-6 border border-gray-700">
                <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Setlist</h2>

                {show.setlist && Object.keys(show.setlist).length > 0 ? (
                    <div className="space-y-6">
                        {/* Set 1 */}
                        {show.setlist.set1 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-3 text-blue-400">Set 1</h3>
                                <ol className="list-decimal list-inside space-y-2">
                                    {show.setlist.set1.map((song, index) => (
                                        <li key={index} className="text-lg text-gray-200">
                                            <span className="font-medium">{song.title}</span>
                                            {!song.is_original && song.original_artist && (
                                                <span className="text-sm text-gray-500 ml-2">
                                                    ({song.original_artist})
                                                </span>
                                            )}
                                            {song.notes && (
                                                <span className="text-sm text-gray-400 italic ml-2">
                                                    - {song.notes}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Set 2 */}
                        {show.setlist.set2 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-3 text-blue-400">Set 2</h3>
                                <ol className="list-decimal list-inside space-y-2">
                                    {show.setlist.set2.map((song, index) => (
                                        <li key={index} className="text-lg text-gray-200">
                                            <span className="font-medium">{song.title}</span>
                                            {!song.is_original && song.original_artist && (
                                                <span className="text-sm text-gray-500 ml-2">
                                                    ({song.original_artist})
                                                </span>
                                            )}
                                            {song.notes && (
                                                <span className="text-sm text-gray-400 italic ml-2">
                                                    - {song.notes}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Set 3 */}
                        {show.setlist.set3 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-3 text-blue-400">Set 3</h3>
                                <ol className="list-decimal list-inside space-y-2">
                                    {show.setlist.set3.map((song, index) => (
                                        <li key={index} className="text-lg text-gray-200">
                                            <span className="font-medium">{song.title}</span>
                                            {!song.is_original && song.original_artist && (
                                                <span className="text-sm text-gray-500 ml-2">
                                                    ({song.original_artist})
                                                </span>
                                            )}
                                            {song.notes && (
                                                <span className="text-sm text-gray-400 italic ml-2">
                                                    - {song.notes}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Encore */}
                        {show.setlist.encore && (
                            <div>
                                <h3 className="text-xl font-semibold mb-3 text-purple-400">Encore</h3>
                                <ol className="list-decimal list-inside space-y-2">
                                    {show.setlist.encore.map((song, index) => (
                                        <li key={index} className="text-lg text-gray-200">
                                            <span className="font-medium">{song.title}</span>
                                            {!song.is_original && song.original_artist && (
                                                <span className="text-sm text-gray-500 ml-2">
                                                    ({song.original_artist})
                                                </span>
                                            )}
                                            {song.notes && (
                                                <span className="text-sm text-gray-400 italic ml-2">
                                                    - {song.notes}
                                                </span>
                                            )}
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

            {/* Back Button at Bottom */}
            <div className="mt-6">
                <Link to="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                    ← Back to Search
                </Link>
            </div>
        </div>
    );
}

