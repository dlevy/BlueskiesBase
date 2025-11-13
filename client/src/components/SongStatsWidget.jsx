import { useState, useEffect } from 'react';
import { getGlobalSongStats } from '../services/api';

export default function SongStatsWidget() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    // Helper function to calculate total plays
    const calculateTotalPlays = (songs) => {
        return songs.reduce((sum, song) => sum + song.playCount, 0);
    };

    // Helper function to format date consistently
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Helper function to format play count
    const formatPlayCount = (count) => {
        return count === 1 ? '1 play' : `${count} plays`;
    };

    // Calculate max play count for progress bars
    const maxOriginalsPlays = stats.originals.top5.length > 0 ? stats.originals.top5[0].playCount : 1;
    const maxCoversPlays = stats.covers.top5.length > 0 ? stats.covers.top5[0].playCount : 1;

    return (
        <div className="space-y-4">
            {/* Compact Header */}
            <h2 className="text-base font-medium text-gray-400 uppercase tracking-wide">
                Song Stats
            </h2>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                {/* Originals Column */}
                <div className="bg-gray-850 border border-gray-700/50 rounded-xl p-6 shadow-lg space-y-6">
                    {/* Column Header */}
                    <div className="flex items-center gap-2 pb-3 border-b border-green-500/20">
                        <h3 className="text-xl font-semibold text-gray-100">Originals</h3>
                        <div className="h-1 flex-1 bg-gradient-to-r from-green-500/30 to-transparent rounded"></div>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-gray-800/50 rounded-lg p-5 border border-green-500/10">
                        <div className="text-center">
                            <div className="text-5xl font-bold text-green-400 mb-2 leading-none">
                                {stats.originals.total}
                            </div>
                            <div className="text-sm font-medium text-gray-300 mb-1">Unique Songs</div>
                            <div className="text-xs text-gray-500">
                                {calculateTotalPlays(stats.originals.top5)} total plays (top 5)
                            </div>
                        </div>
                    </div>

                    {/* Top 5 Most Played */}
                    <div className="bg-gray-800/30 rounded-lg p-5 border border-gray-700/30">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg">🔥</span>
                            <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                                Top 5 Most Played
                            </h4>
                        </div>
                        <ul className="space-y-3.5">
                            {stats.originals.top5.map((song, index) => {
                                const percentage = (song.playCount / maxOriginalsPlays) * 100;
                                return (
                                    <li
                                        key={song.id}
                                        className="group hover:bg-gray-750/50 rounded-lg p-2.5 -mx-2.5 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-green-400 font-bold text-sm mt-0.5 min-w-[1.5rem]">
                                                #{index + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span
                                                        className="font-semibold text-gray-100 leading-relaxed truncate"
                                                        title={song.title}
                                                    >
                                                        {song.title}
                                                    </span>
                                                    <span className="text-sm text-green-300 font-medium whitespace-nowrap flex-shrink-0">
                                                        {formatPlayCount(song.playCount)}
                                                    </span>
                                                </div>
                                                {/* Progress Bar */}
                                                <div className="h-1 bg-gray-700/50 rounded-full overflow-hidden mb-1">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                                {song.lastPlayed && (
                                                    <div className="text-xs text-gray-500 leading-relaxed text-left">
                                                        Last played: {formatDate(song.lastPlayed)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Rarest 5 */}
                    <div className="bg-gray-800/30 rounded-lg p-5 border border-gray-700/30">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg">💎</span>
                            <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                                Rarest 5
                            </h4>
                        </div>
                        <ul className="space-y-3.5">
                            {stats.originals.rarest5.map((song, index) => (
                                <li
                                    key={song.id}
                                    className="group hover:bg-gray-750/50 rounded-lg p-2.5 -mx-2.5 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-purple-400 font-bold text-sm mt-0.5 min-w-[1.5rem]">
                                            #{index + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span
                                                    className="font-semibold text-gray-100 leading-relaxed truncate"
                                                    title={song.title}
                                                >
                                                    {song.title}
                                                </span>
                                                <span className="text-sm text-purple-300 font-medium whitespace-nowrap flex-shrink-0">
                                                    {formatPlayCount(song.playCount)}
                                                </span>
                                            </div>
                                            {song.lastPlayed && (
                                                <div className="text-xs text-gray-500 leading-relaxed text-left">
                                                    Last played: {formatDate(song.lastPlayed)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Covers Column */}
                <div className="bg-gray-850 border border-gray-700/50 rounded-xl p-6 shadow-lg space-y-6">
                    {/* Column Header */}
                    <div className="flex items-center gap-2 pb-3 border-b border-blue-500/20">
                        <h3 className="text-xl font-semibold text-gray-100">Covers</h3>
                        <div className="h-1 flex-1 bg-gradient-to-r from-blue-500/30 to-transparent rounded"></div>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-gray-800/50 rounded-lg p-5 border border-blue-500/10">
                        <div className="text-center">
                            <div className="text-5xl font-bold text-blue-400 mb-2 leading-none">
                                {stats.covers.total}
                            </div>
                            <div className="text-sm font-medium text-gray-300 mb-1">Unique Songs</div>
                            <div className="text-xs text-gray-500">
                                {calculateTotalPlays(stats.covers.top5)} total plays (top 5)
                            </div>
                        </div>
                    </div>

                    {/* Top 5 Most Played */}
                    <div className="bg-gray-800/30 rounded-lg p-5 border border-gray-700/30">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg">🔥</span>
                            <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                                Top 5 Most Played
                            </h4>
                        </div>
                        <ul className="space-y-3.5">
                            {stats.covers.top5.map((song, index) => {
                                const percentage = (song.playCount / maxCoversPlays) * 100;
                                return (
                                    <li
                                        key={song.id}
                                        className="group hover:bg-gray-750/50 rounded-lg p-2.5 -mx-2.5 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-blue-400 font-bold text-sm mt-0.5 min-w-[1.5rem]">
                                                #{index + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span
                                                        className="font-semibold text-gray-100 leading-relaxed truncate"
                                                        title={song.title}
                                                    >
                                                        {song.title}
                                                    </span>
                                                    <span className="text-sm text-blue-300 font-medium whitespace-nowrap flex-shrink-0">
                                                        {formatPlayCount(song.playCount)}
                                                    </span>
                                                </div>
                                                {/* Progress Bar */}
                                                <div className="h-1 bg-gray-700/50 rounded-full overflow-hidden mb-1">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                                {song.original_artist && (
                                                    <div className="text-xs text-gray-400 leading-relaxed text-left">
                                                        {song.original_artist}
                                                    </div>
                                                )}
                                                {song.lastPlayed && (
                                                    <div className="text-xs text-gray-500 leading-relaxed text-left">
                                                        Last played: {formatDate(song.lastPlayed)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Rarest 5 */}
                    <div className="bg-gray-800/30 rounded-lg p-5 border border-gray-700/30">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg">💎</span>
                            <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                                Rarest 5
                            </h4>
                        </div>
                        <ul className="space-y-3.5">
                            {stats.covers.rarest5.map((song, index) => (
                                <li
                                    key={song.id}
                                    className="group hover:bg-gray-750/50 rounded-lg p-2.5 -mx-2.5 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-purple-400 font-bold text-sm mt-0.5 min-w-[1.5rem]">
                                            #{index + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span
                                                    className="font-semibold text-gray-100 leading-relaxed truncate"
                                                    title={song.title}
                                                >
                                                    {song.title}
                                                </span>
                                                <span className="text-sm text-purple-300 font-medium whitespace-nowrap flex-shrink-0">
                                                    {formatPlayCount(song.playCount)}
                                                </span>
                                            </div>
                                            {song.original_artist && (
                                                <div className="text-xs text-gray-400 leading-relaxed text-left">
                                                    {song.original_artist}
                                                </div>
                                            )}
                                            {song.lastPlayed && (
                                                <div className="text-xs text-gray-500 leading-relaxed text-left">
                                                    Last played: {formatDate(song.lastPlayed)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-600 pt-2">
                Data as of {formatDate(new Date().toISOString())}
            </div>
        </div>
    );
}

