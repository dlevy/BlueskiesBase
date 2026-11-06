import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner } from '@porsche-design-system/components-react';
import { supabase } from '../services/supabase';
import { getShowDebutsBatch, checkShowsHaveContent } from '../services/apiCore';
import { getTourRarity } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import ShowTagsRow from './ShowTagsRow';
import { computeShowTagCounts } from '../utils/setlist';

// How far back to look for a show that actually has a setlist. Setlists are
// entered a day or two after the show, so the newest show by date is often still
// empty — checking a window of recent shows avoids rendering a blank section.
const LOOKBACK_SHOWS = 25;
const OTHER_RECENT_SHOWS = 2;

// One card design shared by the featured show and the ones below it — same size, same
// content (artist, venue, tour, tag summary). The only thing that distinguishes "most
// recent" from "the others" is position in the list, not size or how much information is
// shown.
// Exported so NextShowWidget can reuse the exact same card rendering
// inside its own distinctively-styled wrapper, instead of duplicating this.
export function ShowCard({
    show, hasSetlist,
    hasVideo, hasLinks, hasNotes, hasPhotos, hasPoster,
    coverCount, teaseCount, rareCount, tourDebutCount, liveDebutCount,
}) {
    const [y, m, d] = show.show_date.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const monthStr = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
    const dayNum = parseInt(d, 10);

    return (
        <Link
            to={buildShowPath(show)}
            className="flex rounded-xl border border-white/5 bg-white/[0.03] hover:border-amber-500/20 hover:bg-white/[0.06] hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 transition-all duration-150 overflow-hidden group"
        >
            <div className="shrink-0 flex flex-col items-center justify-center w-16 sm:w-20 py-4 bg-white/[0.02] border-r border-white/5">
                <span className="font-display font-bold text-2xl sm:text-3xl leading-none text-amber-400">
                    {dayNum}
                </span>
                <span className="text-[10px] uppercase tracking-widest mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    {monthStr}
                </span>
                <span className="text-[10px] mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>
                    {y}
                </span>
            </div>

            <div className="flex-1 min-w-0 p-4">
                <p className="font-semibold text-base" style={{ color: 'var(--p-color-primary)' }}>
                    {show.artist_name}
                </p>
                {show.venues && (
                    <p className="text-sm mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {show.venues.name}
                        <span style={{ color: 'var(--p-color-contrast-low)' }}>
                            {' — '}{[show.venues.city, show.venues.state].filter(Boolean).join(', ')}
                        </span>
                    </p>
                )}
                {show.tour_name && (
                    <p className="text-xs mt-0.5 italic" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {show.tour_name}
                    </p>
                )}

                {hasSetlist ? (
                    <ShowTagsRow
                        className="mt-3 pt-3 border-t border-white/5"
                        hasVideo={hasVideo} hasLinks={hasLinks} hasNotes={hasNotes} hasPhotos={hasPhotos} hasPoster={hasPoster}
                        coverCount={coverCount} teaseCount={teaseCount} rareCount={rareCount}
                        tourDebutCount={tourDebutCount} liveDebutCount={liveDebutCount}
                    />
                ) : (
                    <p className="mt-3 pt-3 border-t border-white/5 text-xs italic" style={{ color: 'var(--p-color-contrast-low)' }}>
                        Setlist not added yet
                    </p>
                )}
            </div>

            <div className="shrink-0 flex items-center pr-4">
                <svg aria-hidden="true" className="w-4 h-4 opacity-0 group-hover:opacity-30 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </Link>
    );
}

export default function MostRecentShowWidget({ onReady }) {
    const [displayShows, setDisplayShows] = useState([]);
    const [tagsByShow, setTagsByShow] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchMostRecent = async () => {
            try {
                const today = new Date();
                const todayStr = [
                    today.getFullYear(),
                    String(today.getMonth() + 1).padStart(2, '0'),
                    String(today.getDate()).padStart(2, '0'),
                ].join('-');

                const { data: rawShows, error: showsError } = await supabase
                    .from('shows')
                    .select('id, show_date, artist_name, tour_name, links, is_cancelled, venues(name, city, state, country, state_country)')
                    .lte('show_date', todayStr)
                    .order('show_date', { ascending: false })
                    .order('day_order', { ascending: false })
                    .order('id', { ascending: false })
                    .limit(LOOKBACK_SHOWS);

                // A canceled show never happened — not eligible to be featured as a
                // "most recent show" at all, same as it's excluded from "attended".
                const shows = (rawShows || []).filter(s => !s.is_cancelled);

                if (showsError || !shows.length) {
                    if (!cancelled) setLoading(false);
                    return;
                }

                const { data: setlistRows } = await supabase
                    .from('setlist_songs')
                    .select('show_id, song_id, performance_type, songs!setlist_songs_song_id_fkey(is_original)')
                    .in('show_id', shows.map(s => s.id));

                const byShow = {};
                (setlistRows || []).forEach(row => {
                    (byShow[row.show_id] ||= []).push(row);
                });

                // A show dated today is excluded until it either gets a setlist logged or
                // the day passes — a same-day show might not have even happened yet (e.g.
                // visiting the site at 2pm before an 8pm show), so it can't be called
                // "most recent" on date alone. Once it's from a prior day, it's eligible
                // regardless of setlist status; shows is already newest-first, so the
                // newest eligible one naturally lands first/featured with no extra sort.
                const eligible = shows.filter(s => byShow[s.id]?.length > 0 || s.show_date < todayStr);
                if (eligible.length === 0) { if (!cancelled) setLoading(false); return; }

                const shown = eligible.slice(0, 1 + OTHER_RECENT_SHOWS);
                const shownIds = shown.map(s => s.id);

                if (cancelled) return;
                setDisplayShows(shown);

                // Rare depends on tour-wide play counts, fetched once per distinct tour
                // represented among the shown cards (almost always just one) rather than
                // once per show — GET /shows/:id/tour-rarity derives the tour from
                // whichever show id it's given, so any show in that tour will do.
                const tourRarityByTour = {};
                const tourReps = new Map();
                shown.forEach(s => { if (s.tour_name && !tourReps.has(s.tour_name)) tourReps.set(s.tour_name, s.id); });
                await Promise.all([...tourReps.entries()].map(async ([tourName, repId]) => {
                    try {
                        tourRarityByTour[tourName] = await getTourRarity(repId);
                    } catch (err) {
                        console.error('[MostRecentShowWidget] tour rarity fetch failed:', err);
                    }
                }));

                const [debutsByShow, { contentMap }] = await Promise.all([
                    getShowDebutsBatch(shownIds).catch(err => { console.error('[MostRecentShowWidget] debuts fetch failed:', err); return {}; }),
                    checkShowsHaveContent(shownIds).catch(err => { console.error('[MostRecentShowWidget] content fetch failed:', err); return { contentMap: {} }; }),
                ]);

                if (cancelled) return;

                const tagsMap = {};
                shown.forEach(s => {
                    const rows = byShow[s.id] || [];
                    const tourRarity = s.tour_name ? tourRarityByTour[s.tour_name] : undefined;
                    const liveDebutIds = new Set(debutsByShow[s.id]?.live_debut_song_ids || []);
                    const tourDebutIds = new Set(debutsByShow[s.id]?.tour_debut_song_ids || []);
                    const counts = computeShowTagCounts(rows, tourRarity, liveDebutIds, tourDebutIds);
                    const content = contentMap?.[s.id] || {};
                    tagsMap[s.id] = {
                        hasSetlist: rows.length > 0,
                        hasVideo: s.links?.some(l => l.url?.includes('youtube.com') || l.url?.includes('youtu.be')) || false,
                        hasLinks: s.links?.some(l => l.url && !l.url.includes('youtube.com') && !l.url.includes('youtu.be')) || false,
                        hasNotes: content.hasNotes || false,
                        hasPhotos: content.hasPhotos || false,
                        hasPoster: content.hasPoster || false,
                        ...counts,
                    };
                });

                setTagsByShow(tagsMap);
            } catch (err) {
                console.error('[MostRecentShowWidget] Error fetching most recent show:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchMostRecent();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { if (!loading) onReady?.(); }, [loading]);

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 mb-4 flex justify-center">
                <PSpinner size="small" aria={{ 'aria-label': 'Loading most recent show' }} />
            </div>
        );
    }

    if (displayShows.length === 0) return null;

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 mb-4">
            <div className="flex items-baseline justify-between gap-2 mb-4">
                <h2 className="font-display font-bold text-base" style={{ color: 'var(--p-color-primary)' }}>
                    Most Recent Shows
                </h2>
                <Link
                    to="/past-shows"
                    className="text-xs font-medium shrink-0 hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--p-color-info)' }}
                >
                    View All →
                </Link>
            </div>

            <div className="space-y-4">
                {displayShows.map(show => (
                    <ShowCard key={show.id} show={show} {...tagsByShow[show.id]} />
                ))}
            </div>
        </div>
    );
}
