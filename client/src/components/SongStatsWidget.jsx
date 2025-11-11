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
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Song Statistics
            </h2>

            {/* Tab Buttons */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('covers')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        activeTab === 'covers'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                    Covers
                </button>
                <button
                    onClick={() => setActiveTab('originals')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
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
                <div className="space-y-6">
                    {/* Total Covers */}
                    <div className="text-center p-4 bg-gray-750 rounded-lg border border-gray-600">
                        <div className="text-4xl font-bold text-blue-400 mb-1">
                            {stats.covers.total}
                        </div>
                        <div className="text-gray-300">Unique Covers Played</div>
                    </div>

                    {/* Top 5 Covers */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-200 mb-3">
                            🔥 Top 5 Most Played Covers
                        </h3>
                        <div className="space-y-2">
                            {stats.covers.top5.map((song, index) => (
                                <div
                                    key={song.id}
                                    className="flex items-center justify-between p-3 bg-gray-750 rounded-lg border border-gray-600"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl font-bold text-blue-400 w-8">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-100">
                                                {song.title}
                                            </div>
                                            {song.original_artist && (
                                                <div className="text-sm text-gray-400">
                                                    {song.original_artist}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-lg font-semibold text-blue-300">
                                        {song.playCount}x
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rarest 5 Covers */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-200 mb-3">
                            💎 Rarest 5 Covers
                        </h3>
                        <div className="space-y-2">
                            {stats.covers.rarest5.map((song) => (
                                <div
                                    key={song.id}
                                    className="flex items-center justify-between p-3 bg-gray-750 rounded-lg border border-gray-600"
                                >
                                    <div>
                                        <div className="font-medium text-gray-100">
                                            {song.title}
                                        </div>
                                        {song.original_artist && (
                                            <div className="text-sm text-gray-400">
                                                {song.original_artist}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-lg font-semibold text-purple-300">
                                        {song.playCount}x
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Originals Tab */}
            {activeTab === 'originals' && (
                <div className="space-y-6">
                    {/* Total Originals */}
                    <div className="text-center p-4 bg-gray-750 rounded-lg border border-gray-600">
                        <div className="text-4xl font-bold text-green-400 mb-1">
                            {stats.originals.total}
                        </div>
                        <div className="text-gray-300">Unique Originals Played</div>
                    </div>

                    {/* Top 5 Originals */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-200 mb-3">
                            🔥 Top 5 Most Played Originals
                        </h3>
                        <div className="space-y-2">
                            {stats.originals.top5.map((song, index) => (
                                <div
                                    key={song.id}
                                    className="flex items-center justify-between p-3 bg-gray-750 rounded-lg border border-gray-600"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl font-bold text-green-400 w-8">
                                            {index + 1}
                                        </div>
                                        <div className="font-medium text-gray-100">
                                            {song.title}
                                        </div>
                                    </div>
                                    <div className="text-lg font-semibold text-green-300">
                                        {song.playCount}x
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rarest 5 Originals */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-200 mb-3">
                            💎 Rarest 5 Originals
                        </h3>
                        <div className="space-y-2">
                            {stats.originals.rarest5.map((song) => (
                                <div
                                    key={song.id}
                                    className="flex items-center justify-between p-3 bg-gray-750 rounded-lg border border-gray-600"
                                >
                                    <div className="font-medium text-gray-100">
                                        {song.title}
                                    </div>
                                    <div className="text-lg font-semibold text-purple-300">
                                        {song.playCount}x
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

