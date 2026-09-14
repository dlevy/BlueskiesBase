import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner } from '@porsche-design-system/components-react';
import { supabase } from '../services/supabase';
import { getShowDebutsBatch } from '../services/api';
import { fetchTourSongCounts } from '../utils/tourSongCounts';

const LIVE_DEBUT_COLOR = '#34d399';
const TOUR_DEBUT_COLOR = '#22d3ee';
const MOST_PLAYED_COLOR = '#fbbf24'; // amber, the site's own primary accent — "most played" as a highlight
const RAREST_COLOR = '#c084fc';      // same purple as the per-song "Rare" badge on the show page

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SongGroup({ label, color, count, playedShows, songs }) {
    return (
        <div>
            <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    {label}
                </span>
                <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                    {count} of {playedShows} shows &middot; {songs.length} song{songs.length !== 1 ? 's' : ''}
                </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--p-color-contrast-medium)' }}>
                {songs.join(', ')}
            </p>
        </div>
    );
}

/**
 * Aggregate stats for whichever tour the most recent show belongs to: how far in we are,
 * live/tour debut totals, and every song tied for most- and least-played so far. Renders
 * nothing if the most recent show has no tour_name or no setlist data yet to work from —
 * this needs real data to say anything, unlike the other homepage widgets that have a
 * meaningful "nothing yet" state of their own.
 */
export default function TourStatsWidget() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const todayStr = new Date().toISOString().slice(0, 10);

                const { data: recent, error: recentError } = await supabase
                    .from('shows')
                    .select('tour_name')
                    .lte('show_date', todayStr)
                    .order('show_date', { ascending: false })
                    .limit(1);

                const tourName = recent?.[0]?.tour_name;
                if (recentError || !tourName) { if (!cancelled) setLoading(false); return; }

                const tourData = await fetchTourSongCounts(tourName);
                if (!tourData || tourData.songCounts.length === 0) { if (!cancelled) setLoading(false); return; }

                const { totalShows, playedShows, firstDate, lastDate, playedIds, songCounts } = tourData;
                const maxCount = songCounts[0].count;
                const minCount = songCounts[songCounts.length - 1].count;
                const mostPlayed = songCounts.filter(s => s.count === maxCount).map(s => s.title).sort((a, b) => a.localeCompare(b));
                const rarest = songCounts.filter(s => s.count === minCount).map(s => s.title).sort((a, b) => a.localeCompare(b));

                // Live/tour debut totals — same batch computation already verified and
                // shipped for the show page and list-view previews, just summed here.
                let liveDebutCount = 0, tourDebutCount = 0;
                try {
                    const debutsMap = await getShowDebutsBatch(playedIds);
                    Object.values(debutsMap).forEach(d => {
                        liveDebutCount += d.live_debut_song_ids?.length || 0;
                        tourDebutCount += d.tour_debut_song_ids?.length || 0;
                    });
                } catch (err) {
                    console.error('[TourStatsWidget] debuts fetch failed:', err);
                }

                if (cancelled) return;
                setStats({
                    tourName,
                    totalShows,
                    playedShows,
                    firstDate,
                    lastDate,
                    mostPlayed, maxCount,
                    rarest, minCount,
                    liveDebutCount, tourDebutCount,
                });
            } catch (err) {
                console.error('[TourStatsWidget] Error loading tour stats:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 flex justify-center">
                <PSpinner size="small" aria={{ 'aria-label': 'Loading tour stats' }} />
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 space-y-4">
            <div>
                <h3 className="font-display font-bold text-base" style={{ color: 'var(--p-color-primary)' }}>
                    Tour Stats
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>
                    {stats.tourName} &middot; {stats.playedShows} of {stats.totalShows} shows played &middot; {formatDate(stats.firstDate)}
                    {stats.lastDate !== stats.firstDate && <> &rarr; {formatDate(stats.lastDate)}</>}
                </p>
            </div>

            {(stats.liveDebutCount > 0 || stats.tourDebutCount > 0) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {stats.liveDebutCount > 0 && (
                        <span>
                            <span className="font-display font-bold" style={{ color: LIVE_DEBUT_COLOR }}>{stats.liveDebutCount}</span>
                            {' '}<span style={{ color: 'var(--p-color-contrast-medium)' }}>live debut{stats.liveDebutCount !== 1 ? 's' : ''}</span>
                        </span>
                    )}
                    {stats.tourDebutCount > 0 && (
                        <span>
                            <span className="font-display font-bold" style={{ color: TOUR_DEBUT_COLOR }}>{stats.tourDebutCount}</span>
                            {' '}<span style={{ color: 'var(--p-color-contrast-medium)' }}>tour debut{stats.tourDebutCount !== 1 ? 's' : ''}</span>
                        </span>
                    )}
                </div>
            )}

            <SongGroup label="Most Played" color={MOST_PLAYED_COLOR} count={stats.maxCount} playedShows={stats.playedShows} songs={stats.mostPlayed} />

            {stats.minCount < stats.maxCount && (
                <SongGroup label="Rarest So Far" color={RAREST_COLOR} count={stats.minCount} playedShows={stats.playedShows} songs={stats.rarest} />
            )}

            <Link to="/tour-stats" className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:opacity-80 transition-opacity">
                More Tour Stats
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </Link>
        </div>
    );
}
