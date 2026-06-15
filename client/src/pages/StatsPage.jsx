import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { buildShowPath } from '../utils/showSlug';
import { getUserStats } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';

export default function StatsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [urlParams, setUrlParams] = useSearchParams();
    const activeTab = urlParams.get('tab') || 'shows';
    const setActiveTab = (tab) => setUrlParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
    });

    useEffect(() => {
        if (!user) {
            navigate('/member-login');
            return;
        }

        const fetchStats = async (retryCount = 0) => {
            try {
                setLoading(true);
                setError(null);

                console.log('[StatsPage] Fetching stats... (attempt', retryCount + 1, ')');
                const startTime = Date.now();

                const data = await getUserStats();

                const endTime = Date.now();
                const duration = endTime - startTime;
                console.log(`[StatsPage] Stats loaded in ${duration}ms`);

                setStats(data);
            } catch (err) {
                console.error('[StatsPage] Error fetching stats:', err);

                // Retry once if it's a timeout or network error
                if (retryCount === 0 && (err.message.includes('timeout') || err.message.includes('fetch'))) {
                    console.log('[StatsPage] Retrying...');
                    setTimeout(() => fetchStats(1), 1000);
                    return;
                }

                setError(err.message || 'Failed to load statistics. Please try refreshing the page.');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user, navigate]);

    if (loading) {
        return (
            <div className="px-4 py-8 max-w-6xl mx-auto">
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

    if (error) {
        return (
            <div className="px-4 py-8 max-w-6xl mx-auto">
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                    {error}
                </div>
                <Link to="/" className="text-blue-400 hover:text-blue-300 mt-4 inline-block transition-colors">
                    ← Back to Home
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
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

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

    return (
        <div className="px-4 py-8 max-w-6xl mx-auto">
            <SEO
                title="My Concert Stats"
                description="Track your personal Sturgill Simpson and Johnny Blue Skies concert history. See every show you've attended and songs you've heard live."
            />
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    My Concert Statistics
                </h1>
                <p className="text-gray-400">Track your Johnny Blue Skies concert journey</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                    <div className="text-4xl font-bold text-blue-400 mb-2">{pastShows.length}</div>
                    <div className="text-gray-300">Shows Attended</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                    <div className="text-4xl font-bold text-purple-400 mb-2">{upcomingShows.length}</div>
                    <div className="text-gray-300">Upcoming Shows</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                    <div className="text-4xl font-bold text-green-400 mb-2">{stats.totalSongsSeen}</div>
                    <div className="text-gray-300">Songs Seen Live</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                    <div className="text-4xl font-bold text-orange-400 mb-2">{stats.totalSongsNotSeen}</div>
                    <div className="text-gray-300">Songs Not Yet Seen</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-700">
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
                    Songs Seen ({stats.totalSongsSeen})
                </button>
                <button
                    onClick={() => setActiveTab('notSeen')}
                    className={`px-4 py-3 font-medium transition-colors ${
                        activeTab === 'notSeen'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Not Seen ({stats.totalSongsNotSeen})
                </button>
            </div>

            {/* Tab Content */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                {/* Past Shows Tab */}
                {activeTab === 'shows' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-100 mb-4">Shows Attended</h2>
                        {pastShows.length === 0 ? (
                            <p className="text-gray-400">You haven't marked any shows as attended yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {pastShows.map((show) => (
                                    <div key={show.id} className="border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors">
                                        <Link to={buildShowPath(show)} className="block">
                                            <h3 className="text-xl font-semibold text-gray-100 mb-1">
                                                {formatDate(show.show_date)}
                                            </h3>
                                            <p className="text-gray-300">{show.artist_name}</p>
                                            {show.venues && (
                                                <p className="text-gray-400 text-sm">
                                                    {show.venues.name} - {show.venues.city}, {show.venues.state_country}
                                                </p>
                                            )}
                                            {show.tour_name && (
                                                <p className="text-gray-500 text-sm italic mt-1">{show.tour_name}</p>
                                            )}
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Upcoming Shows Tab */}
                {activeTab === 'upcoming' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-100 mb-4">Upcoming Shows</h2>
                        {upcomingShows.length === 0 ? (
                            <p className="text-gray-400">No upcoming shows marked yet. Find a show and click "Mark as Attending"!</p>
                        ) : (
                            <div className="space-y-4">
                                {upcomingShows.map((show) => (
                                    <div key={show.id} className="border border-purple-800/50 rounded-lg p-4 hover:border-purple-500 transition-colors bg-purple-950/20">
                                        <Link to={buildShowPath(show)} className="block">
                                            <h3 className="text-xl font-semibold text-gray-100 mb-1">
                                                {formatDate(show.show_date)}
                                            </h3>
                                            <p className="text-gray-300">{show.artist_name}</p>
                                            {show.venues && (
                                                <p className="text-gray-400 text-sm">
                                                    {show.venues.name} - {show.venues.city}, {show.venues.state_country}
                                                </p>
                                            )}
                                            {show.tour_name && (
                                                <p className="text-purple-400 text-sm italic mt-1">{show.tour_name}</p>
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
                            <p className="text-gray-400">No songs yet. Mark some shows as attended!</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {stats.songsSeen
                                    .sort((a, b) => b.playCount - a.playCount)
                                    .map((song) => (
                                        <div key={song.id} className="border border-gray-700 rounded-lg p-3 bg-gray-750">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-100">{song.title}</div>
                                                    {!song.is_original && song.original_artist && (
                                                        <div className="text-sm text-gray-400 italic">
                                                            Cover - {song.original_artist}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="ml-3 flex-shrink-0">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700">
                                                        {song.playCount}x
                                                    </span>
                                                </div>
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
                            <p className="text-gray-400">Congratulations! You've seen all the songs!</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {stats.songsNotSeen
                                    .sort((a, b) => {
                                        // Sort by most recent show date
                                        if (!a.mostRecentShow || !b.mostRecentShow) return 0;
                                        // Compare date strings directly (YYYY-MM-DD format sorts correctly)
                                        return b.mostRecentShow.show_date.localeCompare(a.mostRecentShow.show_date);
                                    })
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

