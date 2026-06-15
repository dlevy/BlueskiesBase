import { useState, useEffect } from 'react';
import { PHeading, PText, PSpinner, PInlineNotification, PDivider } from '@porsche-design-system/components-react';
import { getGlobalSongStats, getSongs } from '../services/api';
import { useCountUp } from '../hooks/useCountUp';

export default function SongStatsWidget() {
    const [stats, setStats] = useState(null);
    const [holyGrails, setHolyGrails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const statsData = await getGlobalSongStats();
                setStats(statsData);
            } catch (err) {
                console.error('Error fetching song stats:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        const fetchHolyGrails = async () => {
            try {
                const songsData = await getSongs();
                const unplayed = (songsData.songs || []).filter(
                    s => s.is_original === true && s.performance_count === 0
                );

                const albumMap = new Map();
                unplayed.forEach(song => {
                    const assocs = song.album_songs?.filter(as => as.albums) || [];
                    if (assocs.length > 0) {
                        assocs.forEach(as => {
                            const key = as.albums.id;
                            if (!albumMap.has(key)) {
                                albumMap.set(key, {
                                    title: as.albums.title,
                                    releaseDate: as.albums.release_date || '',
                                    songs: [],
                                });
                            }
                            albumMap.get(key).songs.push(song.title);
                        });
                    } else {
                        const key = '__none__';
                        if (!albumMap.has(key)) albumMap.set(key, { title: 'Unreleased', releaseDate: '', songs: [] });
                        albumMap.get(key).songs.push(song.title);
                    }
                });

                setHolyGrails(
                    [...albumMap.values()]
                        .sort((a, b) => {
                            if (!a.releaseDate) return 1;
                            if (!b.releaseDate) return -1;
                            return b.releaseDate.localeCompare(a.releaseDate);
                        })
                        .map(album => ({ ...album, songs: album.songs.sort((a, b) => a.localeCompare(b)) }))
                );
            } catch (err) {
                console.error('Error fetching holy grails:', err);
                // Holy Grails failing silently — stats still show
            }
        };

        fetchStats();
        fetchHolyGrails();
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

    const SongColumn = ({ title, data, accentColor, maxPlays }) => {
        const animatedTotal = useCountUp(data.total);
        return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
            <div>
                <PHeading size="lg" tag="h3">{title}</PHeading>
                <div className="mt-3"><PDivider /></div>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-white/5 bg-white/5 p-5 text-center">
                <div className="font-display font-bold text-5xl leading-none mb-1 text-amber-400">{animatedTotal}</div>
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
    };

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

            {/* Holy Grails */}
            {holyGrails.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-[#1a1e26] p-6 space-y-5">
                    <div>
                        <PHeading size="lg" tag="h3">Holy Grails</PHeading>
                        <PText size="small" color="contrast-medium">Original songs that have never been played live</PText>
                        <div className="mt-3"><PDivider /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                        {holyGrails.map(album => (
                            <div key={album.title}>
                                <PText size="xs" weight="semi-bold" className="uppercase tracking-wide mb-2" style={{ color: '#f59e0b' }}>
                                    {album.title}
                                </PText>
                                <ul className="space-y-1.5 mt-2">
                                    {album.songs.map(title => (
                                        <li key={title} className="flex items-start gap-2">
                                            <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                                            <PText size="small" color="contrast-medium">{title}</PText>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <PText size="xs" color="contrast-low" align="center">
                Data as of {formatDate(new Date().toISOString())}
            </PText>
        </div>
    );
}
