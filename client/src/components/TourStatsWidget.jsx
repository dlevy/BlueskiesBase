import { useState, useEffect } from 'react';
import { PSpinner } from '@porsche-design-system/components-react';
import { supabase } from '../services/supabase';
import { getShowDebutsBatch } from '../services/api';

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

                const { data: tourShows, error: tourError } = await supabase
                    .from('shows')
                    .select('id, show_date')
                    .eq('tour_name', tourName)
                    .order('show_date');

                if (tourError || !tourShows?.length) { if (!cancelled) setLoading(false); return; }

                const played = tourShows.filter(s => s.show_date <= todayStr);
                const playedIds = played.map(s => s.id);
                if (playedIds.length === 0) { if (!cancelled) setLoading(false); return; }

                // Setlist rows for every played show on this tour, paginated — a mature
                // tour's row count can exceed PostgREST's 1000-row default.
                let rows = [];
                for (let rangeStart = 0; ;) {
                    const { data: page, error } = await supabase
                        .from('setlist_songs')
                        .select('song_id, show_id, songs!setlist_songs_song_id_fkey(title)')
                        .in('show_id', playedIds)
                        .order('id')
                        .range(rangeStart, rangeStart + 999);
                    if (error || !page?.length) break;
                    rows = rows.concat(page);
                    if (page.length < 1000) break;
                    rangeStart += 1000;
                }

                if (rows.length === 0) { if (!cancelled) setLoading(false); return; }

                // Distinct shows per song — a song sandwiched (jammed out of and back into)
                // within one show still only counts once for that show, since this groups
                // by show_id per title rather than counting rows.
                const showSetsByTitle = {};
                rows.forEach(r => {
                    const title = r.songs?.title;
                    if (!title) return;
                    (showSetsByTitle[title] ||= new Set()).add(r.show_id);
                });
                const counts = Object.entries(showSetsByTitle).map(([title, shows]) => [title, shows.size]);
                const maxCount = Math.max(...counts.map(c => c[1]));
                const minCount = Math.min(...counts.map(c => c[1]));
                const mostPlayed = counts.filter(c => c[1] === maxCount).map(c => c[0]).sort((a, b) => a.localeCompare(b));
                const rarest = counts.filter(c => c[1] === minCount).map(c => c[0]).sort((a, b) => a.localeCompare(b));

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
                    totalShows: tourShows.length,
                    playedShows: played.length,
                    firstDate: tourShows[0].show_date,
                    lastDate: tourShows[tourShows.length - 1].show_date,
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
        </div>
    );
}
