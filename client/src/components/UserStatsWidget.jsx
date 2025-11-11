import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserStats } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function UserStatsWidget() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('shows'); // 'shows', 'seen', 'notSeen'

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchStats = async (retryCount = 0) => {
            try {
                setLoading(true);
                setError(null);

                console.log('[UserStatsWidget] Fetching stats... (attempt', retryCount + 1, ')');
                const startTime = Date.now();

                const data = await getUserStats();

                const endTime = Date.now();
                const duration = endTime - startTime;
                console.log(`[UserStatsWidget] Stats loaded in ${duration}ms`);

                setStats(data);
            } catch (err) {
                console.error('[UserStatsWidget] Error fetching stats:', err);

                // Retry once if it's a timeout or network error
                if (retryCount === 0 && (err.message.includes('timeout') || err.message.includes('fetch'))) {
                    console.log('[UserStatsWidget] Retrying...');
                    setTimeout(() => fetchStats(1), 1000);
                    return;
                }

                setError(err.message || 'Failed to load statistics. Please try refreshing the page.');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user]);

    const formatDate = (dateString) => {
        // Parse date as local date to avoid timezone issues
        // Date string format: "YYYY-MM-DD"
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Not logged in
    if (!user) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
                <div className="text-gray-300 mb-4">
                    You must be logged in and have marked at least one concert as attended to view your stats.
                </div>
                <Link
                    to="/member-login"
                    className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Log In
                </Link>
            </div>
        );
    }

    // Loading
    if (loading) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
                <div className="text-center">
                    <div className="text-xl text-gray-300 mb-4">Loading your statistics...</div>
                    <div className="text-sm text-gray-500">This may take a few seconds...</div>
                    {/* Spinner */}
                    <div className="mt-6 flex justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
                    </div>
                </div>
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                    {error}
                </div>
            </div>
        );
    }

    // No shows attended
    if (!stats || stats.attendedShows.length === 0) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
                <div className="text-gray-300 mb-4">
                    You haven't marked any shows as attended yet.
                </div>
                <div className="text-sm text-gray-500">
                    Browse shows and click "I Was There" to start tracking your concert history!
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                    <div className="text-4xl font-bold text-blue-400 mb-2">
                        {stats.attendedShows.length}
                    </div>
                    <div className="text-gray-300">Shows Attended</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                    <div className="text-4xl font-bold text-green-400 mb-2">
                        {stats.songsSeen.length}
                    </div>
                    <div className="text-gray-300">Songs Seen Live</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                    <div className="text-4xl font-bold text-purple-400 mb-2">
                        {stats.songsNotSeen.length}
                    </div>
                    <div className="text-gray-300">Songs Not Seen Yet</div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-700">
                <button
                    onClick={() => setActiveTab('shows')}
                    className={`px-4 py-2 font-medium transition-colors ${
                        activeTab === 'shows'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Attended Shows ({stats.attendedShows.length})
                </button>
                <button
                    onClick={() => setActiveTab('seen')}
                    className={`px-4 py-2 font-medium transition-colors ${
                        activeTab === 'seen'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Songs Seen ({stats.songsSeen.length})
                </button>
                <button
                    onClick={() => setActiveTab('notSeen')}
                    className={`px-4 py-2 font-medium transition-colors ${
                        activeTab === 'notSeen'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Not Seen Yet ({stats.songsNotSeen.length})
                </button>
            </div>

            {/* Tab Content */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                {/* Attended Shows Tab */}
                {activeTab === 'shows' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-100 mb-4">Attended Shows</h2>
                        {stats.attendedShows.length === 0 ? (
                            <p className="text-gray-400">You haven't marked any shows as attended yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {stats.attendedShows.map((show) => (
                                    <div key={show.id} className="border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors">
                                        <Link to={`/show/${show.id}`} className="block">
                                            <h3 className="text-xl font-semibold text-gray-100 mb-1">
                                                {formatDate(show.show_date)}
                                            </h3>
                                            <p className="text-gray-300">{show.artist_name}</p>
                                            {show.venues && (
                                                <p className="text-gray-400 text-sm">
                                                    {show.venues.name} - {show.venues.city}, {show.venues.state_country}
                                                </p>
                                            )}
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Songs Seen Tab */}
                {activeTab === 'seen' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-100 mb-4">Songs You've Seen Live</h2>
                        {stats.songsSeen.length === 0 ? (
                            <p className="text-gray-400">No songs tracked yet.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {stats.songsSeen
                                    .sort((a, b) => a.title.localeCompare(b.title))
                                    .map((song) => (
                                        <div key={song.id} className="border border-gray-700 rounded-lg p-4 bg-gray-750">
                                            <div className="font-medium text-gray-100 mb-1">{song.title}</div>
                                            {!song.is_original && song.original_artist && (
                                                <div className="text-sm text-gray-400 italic mb-2">
                                                    Cover - {song.original_artist}
                                                </div>
                                            )}
                                            <div className="text-sm text-blue-400">
                                                Seen {song.playCount} {song.playCount === 1 ? 'time' : 'times'}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Songs Not Seen Tab */}
                {activeTab === 'notSeen' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-100 mb-4">Songs You Haven't Seen Yet</h2>
                        {stats.songsNotSeen.length === 0 ? (
                            <p className="text-gray-400">You've seen all the songs! 🎉</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {stats.songsNotSeen
                                    .sort((a, b) => a.title.localeCompare(b.title))
                                    .map((song) => (
                                        <div key={song.id} className="border border-gray-700 rounded-lg p-4 bg-gray-750 text-center">
                                            <div className="font-medium text-gray-100 text-lg mb-1">{song.title}</div>
                                            {!song.is_original && song.original_artist && (
                                                <div className="text-sm text-gray-400 italic mb-2">
                                                    Cover - {song.original_artist}
                                                </div>
                                            )}
                                            {song.mostRecentShow && (
                                                <div className="mt-2">
                                                    <div className="text-xs text-gray-400 mb-1">Last played on:</div>
                                                    <Link
                                                        to={`/show/${song.mostRecentShow.id}`}
                                                        className="text-blue-400 hover:text-blue-300 transition-colors text-sm inline-block"
                                                    >
                                                        {formatDate(song.mostRecentShow.show_date)}
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

