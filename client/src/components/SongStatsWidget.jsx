import { useState, useEffect } from 'react';
import { PHeading, PText, PSpinner, PInlineNotification, PDivider } from '@porsche-design-system/components-react';
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

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-8 flex flex-col items-center gap-4">
                <PSpinner size="large" aria={{ 'aria-label': 'Loading song statistics' }} />
                <PText color="contrast-medium">Loading statistics…</PText>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6">
                <PInlineNotification heading="Failed to load song stats" description={error || 'Unknown error'} state="error" dismissButton={false} />
            </div>
        );
    }

    const maxOriginalsPlays = stats.originals.top5.length > 0 ? stats.originals.top5[0].playCount : 1;
    const maxCoversPlays = stats.covers.top5.length > 0 ? stats.covers.top5[0].playCount : 1;
    const totalPlays = (songs) => songs.reduce((sum, s) => sum + s.playCount, 0);

    const SongColumn = ({ title, data, accentColor, maxPlays }) => (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
            <div>
                <PHeading size="lg" tag="h3">{title}</PHeading>
                <div className="mt-3"><PDivider /></div>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-white/5 bg-white/5 p-5 text-center">
                <PHeading size="4xl" tag="p">{data.total}</PHeading>
                <PText size="sm" color="contrast-medium">Unique Songs</PText>
                <PText size="xs" color="contrast-low">{totalPlays(data.top5)} total plays (top 5)</PText>
            </div>

            {/* Top 5 */}
            <div>
                <PText size="xs" color="contrast-medium" className="uppercase tracking-wide font-semibold mb-4">
                    Top 5 Most Played
                </PText>
                <ul className="space-y-4">
                    {data.top5.map((song, index) => {
                        const pct = (song.playCount / maxPlays) * 100;
                        return (
                            <li key={song.id} className="flex items-start gap-3">
                                <span className="font-bold text-sm mt-0.5 shrink-0 w-6" style={{ color: accentColor }}>
                                    #{index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <PText weight="semi-bold" ellipsis>{song.title}</PText>
                                        <PText size="xs" color="contrast-medium" className="whitespace-nowrap shrink-0">
                                            {song.playCount === 1 ? '1 play' : `${song.playCount} plays`}
                                        </PText>
                                    </div>
                                    <div className="h-1 rounded-full overflow-hidden mb-1" style={{ background: 'var(--p-color-contrast-lower)' }}>
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${pct}%`, background: accentColor }}
                                        />
                                    </div>
                                    {song.original_artist && (
                                        <PText size="xs" color="contrast-low">{song.original_artist}</PText>
                                    )}
                                    {song.lastPlayed && (
                                        <PText size="xs" color="contrast-low">Last: {formatDate(song.lastPlayed)}</PText>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <PHeading size="xs" tag="h2">Song Stats</PHeading>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SongColumn
                    title="Originals"
                    data={stats.originals}
                    accentColor="var(--p-color-success)"
                    maxPlays={maxOriginalsPlays}
                />
                <SongColumn
                    title="Covers"
                    data={stats.covers}
                    accentColor="var(--p-color-info)"
                    maxPlays={maxCoversPlays}
                />
            </div>
            <PText size="xs" color="contrast-low" align="center">
                Data as of {formatDate(new Date().toISOString())}
            </PText>
        </div>
    );
}
