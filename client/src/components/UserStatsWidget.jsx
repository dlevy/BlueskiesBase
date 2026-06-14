import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserStats } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function UserStatsWidget() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('shows'); // 'shows', 'upcoming', 'seen', 'notSeen'

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
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatDateLong = (dateString) => {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isUpcoming = (dateString) => {
        const [y, m, d] = dateString.split('-');
        return new Date(y, m - 1, d) >= today;
    };
    const upcomingShows = stats.attendedShows
        .filter(s => isUpcoming(s.show_date))
        .sort((a, b) => a.show_date.localeCompare(b.show_date));
    const pastShows = stats.attendedShows
        .filter(s => !isUpcoming(s.show_date))
        .sort((a, b) => b.show_date.localeCompare(a.show_date));

    // No shows attended or attending
    if (!stats || stats.attendedShows.length === 0) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
                <div className="text-gray-300 mb-4">
                    You haven't marked any shows yet.
                </div>
                <div className="text-sm text-gray-500">
                    Browse shows and click "Mark as Attended" or "Mark as Attending" to start tracking!
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Compact Header */}
            <h2 className="text-base font-medium text-gray-400 uppercase tracking-wide">
                My Stats
            </h2>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-850 border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <div className="text-center">
                        <div className="text-5xl font-bold text-blue-400 mb-2 leading-none">
                            {pastShows.length}
                        </div>
                        <div className="text-sm font-medium text-gray-300">Shows Attended</div>
                    </div>
                </div>
                <div className="bg-gray-850 border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <div className="text-center">
                        <div className="text-5xl font-bold text-purple-400 mb-2 leading-none">
                            {upcomingShows.length}
                        </div>
                        <div className="text-sm font-medium text-gray-300">Upcoming Shows</div>
                    </div>
                </div>
                <div className="bg-gray-850 border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <div className="text-center">
                        <div className="text-5xl font-bold text-green-400 mb-2 leading-none">
                            {stats.songsSeen.length}
                        </div>
                        <div className="text-sm font-medium text-gray-300">Songs Seen Live</div>
                    </div>
                </div>
                <div className="bg-gray-850 border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <div className="text-center">
                        <div className="text-5xl font-bold text-purple-400 mb-2 leading-none">
                            {stats.songsNotSeen.length}
                        </div>
                        <div className="text-sm font-medium text-gray-300">Songs Not Seen Yet</div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 border-b border-gray-700/50">
                <button
                    onClick={() => setActiveTab('shows')}
                    className={`px-4 py-3 font-medium transition-colors ${
                        activeTab === 'shows'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Past Shows ({pastShows.length})
                </button>
                <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`px-4 py-3 font-medium transition-colors ${
                        activeTab === 'upcoming'
                            ? 'text-purple-400 border-b-2 border-purple-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Upcoming ({upcomingShows.length})
                </button>
                <button
                    onClick={() => setActiveTab('seen')}
                    className={`px-4 py-3 font-medium transition-colors ${
                        activeTab === 'seen'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Songs Seen ({stats.songsSeen.length})
                </button>
                <button
                    onClick={() => setActiveTab('notSeen')}
                    className={`px-4 py-3 font-medium transition-colors ${
                        activeTab === 'notSeen'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Not Seen Yet ({stats.songsNotSeen.length})
                </button>
            </div>

            {/* Tab Content */}
            <div className="bg-gray-850 border border-gray-700/50 rounded-xl p-6 shadow-lg">
                {/* Past Shows Tab */}
                {activeTab === 'shows' && (
                    <div>
                        <div className="flex items-center gap-2 pb-4 mb-6 border-b border-blue-500/20">
                            <h3 className="text-xl font-semibold text-gray-100">Shows Attended</h3>
                            <div className="h-1 flex-1 bg-gradient-to-r from-blue-500/30 to-transparent rounded"></div>
                        </div>
                        {pastShows.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">No past shows yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {pastShows.map((show) => (
                                    <Link
                                        key={show.id}
                                        to={`/show/${show.id}`}
                                        className="block bg-gray-800/30 border border-gray-700/30 rounded-lg p-4 hover:bg-gray-750/50 hover:border-blue-500/50 transition-all group"
                                    >
                                        <h4 className="text-lg font-semibold text-gray-100 mb-1 group-hover:text-blue-400 transition-colors">
                                            {formatDateLong(show.show_date)}
                                        </h4>
                                        <p className="text-gray-300 font-medium mb-1">{show.artist_name}</p>
                                        {show.venues && (
                                            <p className="text-sm text-gray-500 leading-relaxed">
                                                {show.venues.name} • {show.venues.city}, {show.venues.state_country}
                                            </p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Upcoming Shows Tab */}
                {activeTab === 'upcoming' && (
                    <div>
                        <div className="flex items-center gap-2 pb-4 mb-6 border-b border-purple-500/20">
                            <h3 className="text-xl font-semibold text-gray-100">Upcoming Shows</h3>
                            <div className="h-1 flex-1 bg-gradient-to-r from-purple-500/30 to-transparent rounded"></div>
                        </div>
                        {upcomingShows.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">No upcoming shows marked yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {upcomingShows.map((show) => (
                                    <Link
                                        key={show.id}
                                        to={`/show/${show.id}`}
                                        className="block bg-purple-950/20 border border-purple-800/50 rounded-lg p-4 hover:bg-purple-900/20 hover:border-purple-500/50 transition-all group"
                                    >
                                        <h4 className="text-lg font-semibold text-gray-100 mb-1 group-hover:text-purple-400 transition-colors">
                                            {formatDateLong(show.show_date)}
                                        </h4>
                                        <p className="text-gray-300 font-medium mb-1">{show.artist_name}</p>
                                        {show.venues && (
                                            <p className="text-sm text-gray-500 leading-relaxed">
                                                {show.venues.name} • {show.venues.city}, {show.venues.state_country}
                                            </p>
                                        )}
                                        {show.tour_name && (
                                            <p className="text-xs text-purple-400/70 mt-1 italic">{show.tour_name}</p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Songs Seen Tab */}
                {activeTab === 'seen' && (
                    <div>
                        <div className="flex items-center gap-2 pb-4 mb-6 border-b border-green-500/20">
                            <h3 className="text-xl font-semibold text-gray-100">Songs You've Seen Live</h3>
                            <div className="h-1 flex-1 bg-gradient-to-r from-green-500/30 to-transparent rounded"></div>
                        </div>
                        {stats.songsSeen.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">No songs tracked yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {stats.songsSeen
                                    .sort((a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title))
                                    .map((song) => (
                                        <div
                                            key={song.id}
                                            className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-gray-800/40 transition-colors"
                                        >
                                            <div className="min-w-0">
                                                <span className="font-medium text-gray-100">{song.title}</span>
                                                {!song.is_original && (
                                                    <span className="text-xs text-blue-400 ml-2">Cover</span>
                                                )}
                                            </div>
                                            <span className="text-xs font-medium text-green-400 whitespace-nowrap flex-shrink-0">
                                                {song.playCount}x
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Songs Not Seen Tab */}
                {activeTab === 'notSeen' && (
                    <div>
                        <div className="flex items-center gap-2 pb-4 mb-6 border-b border-purple-500/20">
                            <h3 className="text-xl font-semibold text-gray-100">Songs You Haven't Seen Yet</h3>
                            <div className="h-1 flex-1 bg-gradient-to-r from-purple-500/30 to-transparent rounded"></div>
                        </div>
                        {stats.songsNotSeen.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-3">🎉</div>
                                <p className="text-gray-300 text-lg font-medium">You've seen all the songs!</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {stats.songsNotSeen
                                    .sort((a, b) => a.title.localeCompare(b.title))
                                    .map((song) => (
                                        <div
                                            key={song.id}
                                            className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-gray-800/40 transition-colors"
                                        >
                                            <div className="min-w-0">
                                                <span className="font-medium text-gray-100">{song.title}</span>
                                                {!song.is_original && (
                                                    <span className="text-xs text-blue-400 ml-2">Cover</span>
                                                )}
                                            </div>
                                            {song.mostRecentShow && (
                                                <Link
                                                    to={`/show/${song.mostRecentShow.id}`}
                                                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors whitespace-nowrap flex-shrink-0"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    Last played: {formatDate(song.mostRecentShow.show_date)}
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-600 pt-2">
                Data as of {formatDate(new Date().toISOString().split('T')[0])}
            </div>
        </div>
    );
}

