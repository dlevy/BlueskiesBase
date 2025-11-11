import { useState, useEffect } from 'react';
import { getGlobalSongStats } from '../services/api';

export default function SongStatsWidget() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('covers'); // 'covers' or 'originals'

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const data = await getGlobalSongStats();
                setStats(data);
            } catch (err) {
                console.error('Error fetching song stats:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    Song Statistics
                </h2>
                <div className="text-gray-400">Loading stats...</div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    Song Statistics
                </h2>
                <div className="text-red-400">Failed to load statistics</div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 lg:p-5 sticky top-4">
            <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Song Stats
            </h2>

            {/* Tab Buttons */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setActiveTab('covers')}
                    className={`flex-1 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                        activeTab === 'covers'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                    Covers
                </button>
                <button
                    onClick={() => setActiveTab('originals')}
                    className={`flex-1 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                        activeTab === 'originals'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                    Originals
                </button>
            </div>

            {/* Covers Tab */}
            {activeTab === 'covers' && (
                <div className="space-y-4">
                    {/* Total Covers */}
                    <div className="text-center p-3 bg-gray-750 rounded-lg border border-gray-600">
                        <div className="text-3xl font-bold text-blue-400 mb-0.5">
                            {stats.covers.total}
                        </div>
                        <div className="text-sm text-gray-300">Unique Covers</div>
                    </div>

                    {/* Top 5 Covers */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-200 mb-2">
                            🔥 Top 5 Most Played
                        </h3>
                        <div className="space-y-1.5">
                            {stats.covers.top5.map((song, index) => (
                                <div
                                    key={song.id}
                                    className="flex flex-col p-2 bg-gray-750 rounded border border-gray-600"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <div className="text-lg font-bold text-blue-400 w-5 flex-shrink-0">
                                                {index + 1}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-gray-100 text-sm truncate">
                                                    {song.title}
                                                </div>
                                                {song.original_artist && (
                                                    <div className="text-xs text-gray-400 truncate">
                                                        {song.original_artist}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-sm font-semibold text-blue-300 ml-2 flex-shrink-0">
                                            {song.playCount}x
                                        </div>
                                    </div>
                                    {song.lastPlayed && (
                                        <div className="text-xs text-gray-500 mt-1 ml-7">
                                            Last played: {new Date(song.lastPlayed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rarest 5 Covers */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-200 mb-2">
                            💎 Rarest 5
                        </h3>
                        <div className="space-y-1.5">
                            {stats.covers.rarest5.map((song, index) => (
                                <div
                                    key={song.id}
                                    className="flex flex-col p-2 bg-gray-750 rounded border border-gray-600"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <div className="text-lg font-bold text-purple-400 w-5 flex-shrink-0">
                                                {index + 1}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-gray-100 text-sm truncate">
                                                    {song.title}
                                                </div>
                                                {song.original_artist && (
                                                    <div className="text-xs text-gray-400 truncate">
                                                        {song.original_artist}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-sm font-semibold text-purple-300 ml-2 flex-shrink-0">
                                            {song.playCount}x
                                        </div>
                                    </div>
                                    {song.lastPlayed && (
                                        <div className="text-xs text-gray-500 mt-1 ml-7">
                                            Last played: {new Date(song.lastPlayed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Originals Tab */}
            {activeTab === 'originals' && (
                <div className="space-y-4">
                    {/* Total Originals */}
                    <div className="text-center p-3 bg-gray-750 rounded-lg border border-gray-600">
                        <div className="text-3xl font-bold text-green-400 mb-0.5">
                            {stats.originals.total}
                        </div>
                        <div className="text-sm text-gray-300">Unique Originals</div>
                    </div>

                    {/* Top 5 Originals */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-200 mb-2">
                            🔥 Top 5 Most Played
                        </h3>
                        <div className="space-y-1.5">
                            {stats.originals.top5.map((song, index) => (
                                <div
                                    key={song.id}
                                    className="flex flex-col p-2 bg-gray-750 rounded border border-gray-600"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="text-lg font-bold text-green-400 w-5 flex-shrink-0">
                                                {index + 1}
                                            </div>
                                            <div className="font-medium text-gray-100 text-sm truncate">
                                                {song.title}
                                            </div>
                                        </div>
                                        <div className="text-sm font-semibold text-green-300 ml-2 flex-shrink-0">
                                            {song.playCount}x
                                        </div>
                                    </div>
                                    {song.lastPlayed && (
                                        <div className="text-xs text-gray-500 mt-1 ml-7">
                                            Last played: {new Date(song.lastPlayed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rarest 5 Originals */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-200 mb-2">
                            💎 Rarest 5
                        </h3>
                        <div className="space-y-1.5">
                            {stats.originals.rarest5.map((song, index) => (
                                <div
                                    key={song.id}
                                    className="flex flex-col p-2 bg-gray-750 rounded border border-gray-600"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="text-lg font-bold text-purple-400 w-5 flex-shrink-0">
                                                {index + 1}
                                            </div>
                                            <div className="font-medium text-gray-100 text-sm truncate">
                                                {song.title}
                                            </div>
                                        </div>
                                        <div className="text-sm font-semibold text-purple-300 ml-2 flex-shrink-0">
                                            {song.playCount}x
                                        </div>
                                    </div>
                                    {song.lastPlayed && (
                                        <div className="text-xs text-gray-500 mt-1 ml-7">
                                            Last played: {new Date(song.lastPlayed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

