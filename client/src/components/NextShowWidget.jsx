import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { getShowDebutsBatch, checkShowsHaveContent } from '../services/apiCore';
import { getTourRarity } from '../services/api';
import { ShowCard } from './MostRecentShowWidget';
import { computeShowTagCounts } from '../utils/setlist';

// The single soonest show at or after today — "Tonight's Show" when that's
// literally today, "Next Show" otherwise (with a days-away note so it's
// clear why a show that isn't today is still being featured up top). Only
// a same-day show gets excluded from UpcomingShowsWidget's own list (see
// its own comment) — a future "Next Show" is deliberately left in both
// places, since here it's just highlighted, not removed from the list.
export default function NextShowWidget({ onReady }) {
    const [show, setShow] = useState(null);
    const [tags, setTags] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isTonight, setIsTonight] = useState(false);
    const [daysAway, setDaysAway] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const fetchNextShow = async () => {
            try {
                const today = new Date();
                const todayStr = [
                    today.getFullYear(),
                    String(today.getMonth() + 1).padStart(2, '0'),
                    String(today.getDate()).padStart(2, '0'),
                ].join('-');

                const { data: rawShows, error: showsError } = await supabase
                    .from('shows')
                    .select('id, show_date, artist_name, tour_name, links, is_cancelled, venues(name, city, state_country)')
                    .gte('show_date', todayStr)
                    .order('show_date', { ascending: true })
                    .order('day_order', { ascending: true })
                    .order('id')
                    .limit(10);

                // A canceled show was never really going to happen — skip it and
                // feature the next real one, same as it's excluded from "upcoming".
                const nextShow = (rawShows || []).find(s => !s.is_cancelled);

                if (showsError || !nextShow) {
                    if (!cancelled) setLoading(false);
                    return;
                }

                const { data: setlistRows } = await supabase
                    .from('setlist_songs')
                    .select('show_id, song_id, performance_type, songs!setlist_songs_song_id_fkey(is_original)')
                    .eq('show_id', nextShow.id);

                if (cancelled) return;
                setShow(nextShow);
                setIsTonight(nextShow.show_date === todayStr);
                // Calendar-day difference, not a 24h-based one — "tomorrow" should
                // read as 1 day away right from midnight, not depend on what time
                // right now happens to be.
                const [y, m, d] = nextShow.show_date.split('-').map(Number);
                const showMidnight = new Date(y, m - 1, d);
                const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                setDaysAway(Math.round((showMidnight - todayMidnight) / (24 * 60 * 60 * 1000)));

                const rows = setlistRows || [];

                const [tourRarity, debutsByShow, { contentMap }] = await Promise.all([
                    nextShow.tour_name
                        ? getTourRarity(nextShow.id).catch(err => { console.error('[NextShowWidget] tour rarity fetch failed:', err); return undefined; })
                        : Promise.resolve(undefined),
                    getShowDebutsBatch([nextShow.id]).catch(err => { console.error('[NextShowWidget] debuts fetch failed:', err); return {}; }),
                    checkShowsHaveContent([nextShow.id]).catch(err => { console.error('[NextShowWidget] content fetch failed:', err); return { contentMap: {} }; }),
                ]);

                if (cancelled) return;

                const liveDebutIds = new Set(debutsByShow[nextShow.id]?.live_debut_song_ids || []);
                const tourDebutIds = new Set(debutsByShow[nextShow.id]?.tour_debut_song_ids || []);
                const counts = computeShowTagCounts(rows, tourRarity, liveDebutIds, tourDebutIds);
                const content = contentMap?.[nextShow.id] || {};

                setTags({
                    hasSetlist: rows.length > 0,
                    hasVideo: nextShow.links?.some(l => l.url?.includes('youtube.com') || l.url?.includes('youtu.be')) || false,
                    hasLinks: nextShow.links?.some(l => l.url && !l.url.includes('youtube.com') && !l.url.includes('youtu.be')) || false,
                    hasNotes: content.hasNotes || false,
                    hasPhotos: content.hasPhotos || false,
                    hasPoster: content.hasPoster || false,
                    ...counts,
                });
            } catch (err) {
                console.error('[NextShowWidget] Error fetching next show:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchNextShow();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { if (!loading) onReady?.(); }, [loading]);

    if (loading || !show) return null;

    return (
        <div className="relative rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-[#1a1e26] to-[#1a1e26] p-5 mb-4 shadow-lg shadow-amber-500/10">
            <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-2.5 w-2.5">
                    {isTonight && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />}
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
                <h2 className="font-display font-bold text-base uppercase tracking-wide" style={{ color: '#fbbf24' }}>
                    {isTonight ? "Tonight's Show" : 'Next Show'}
                </h2>
                {!isTonight && (
                    <span className="text-xs font-medium" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`}
                    </span>
                )}
            </div>

            <ShowCard show={show} {...tags} />
        </div>
    );
}
