import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner } from '@porsche-design-system/components-react';
import { supabase } from '../services/supabase';
import { getShowDebutsBatch } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import SetlistPreview from './SetlistPreview';
import { orderSetlistSongs } from '../utils/setlist';

// How far back to look for a show that actually has a setlist. Setlists are
// entered a day or two after the show, so the newest show by date is often still
// empty — checking a window of recent shows avoids rendering a blank section.
const LOOKBACK_SHOWS = 25;
const PREVIEW_SONGS = 12;
const OTHER_RECENT_SHOWS = 3;

// One card design shared by the featured show and the ones below it — same size, same
// content (artist, venue, tour, full setlist preview with debut tags). The only thing
// that distinguishes "most recent" from "the others" is position in the list, not size
// or how much information is shown.
function ShowCard({ show, songs, totalSongs, liveDebutIds, tourDebutIds }) {
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
                            {' — '}{show.venues.city}{show.venues.state_country ? `, ${show.venues.state_country}` : ''}
                        </span>
                    </p>
                )}
                {show.tour_name && (
                    <p className="text-xs mt-0.5 italic" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {show.tour_name}
                    </p>
                )}

                {songs.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-white/5">
                        <SetlistPreview
                            songs={songs}
                            total={totalSongs}
                            liveDebutIds={liveDebutIds}
                            tourDebutIds={tourDebutIds}
                            max={PREVIEW_SONGS}
                        />
                    </div>
                ) : (
                    <p className="mt-3 pt-3 border-t border-white/5 text-xs italic" style={{ color: 'var(--p-color-contrast-low)' }}>
                        Setlist not added yet
                    </p>
                )}
            </div>

            <div className="shrink-0 flex items-center pr-4">
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-30 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </Link>
    );
}

export default function MostRecentShowWidget() {
    const [displayShows, setDisplayShows] = useState([]);
    const [songsByShow, setSongsByShow] = useState({});
    const [debutsByShow, setDebutsByShow] = useState({});
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

                const { data: shows, error: showsError } = await supabase
                    .from('shows')
                    .select('id, show_date, artist_name, tour_name, venues(name, city, state_country)')
                    .lte('show_date', todayStr)
                    .order('show_date', { ascending: false })
                    .limit(LOOKBACK_SHOWS);

                if (showsError || !shows?.length) {
                    if (!cancelled) setLoading(false);
                    return;
                }

                const { data: setlistRows } = await supabase
                    .from('setlist_songs')
                    .select('show_id, song_id, set_number, song_order, is_encore, songs!setlist_songs_song_id_fkey(title)')
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

                const songsMap = {};
                shown.forEach(s => {
                    const rows = byShow[s.id] || [];
                    songsMap[s.id] = { songs: orderSetlistSongs(rows), total: rows.length };
                });

                if (cancelled) return;
                setDisplayShows(shown);
                setSongsByShow(songsMap);

                getShowDebutsBatch(shown.map(s => s.id))
                    .then(data => {
                        if (cancelled) return;
                        setDebutsByShow(data);
                    })
                    .catch(err => console.error('[MostRecentShowWidget] debuts fetch failed:', err));
            } catch (err) {
                console.error('[MostRecentShowWidget] Error fetching most recent show:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchMostRecent();
        return () => { cancelled = true; };
    }, []);

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
            <h2 className="font-display font-bold text-base mb-4" style={{ color: 'var(--p-color-primary)' }}>
                Most Recent Shows
            </h2>

            <div className="space-y-4">
                {displayShows.map(show => (
                    <ShowCard
                        key={show.id}
                        show={show}
                        songs={songsByShow[show.id]?.songs || []}
                        totalSongs={songsByShow[show.id]?.total || 0}
                        liveDebutIds={new Set(debutsByShow[show.id]?.live_debut_song_ids || [])}
                        tourDebutIds={new Set(debutsByShow[show.id]?.tour_debut_song_ids || [])}
                    />
                ))}
            </div>
        </div>
    );
}
