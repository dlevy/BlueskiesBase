import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner } from '@porsche-design-system/components-react';
import { supabase } from '../services/supabase';
import { getShowDebuts } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import SetlistPreview from './SetlistPreview';
import { orderSetlistSongs } from '../utils/setlist';

// How far back to look for a show that actually has a setlist. Setlists are
// entered a day or two after the show, so the newest show by date is often still
// empty — checking a window of recent shows avoids rendering a blank section.
const LOOKBACK_SHOWS = 25;
const PREVIEW_SONGS = 12;
const OTHER_RECENT_SHOWS = 3;

// Same card, same exact dimensions as the featured show below — identical date column
// (w-16 sm:w-20, same type scale) and content/arrow padding — just one line of info
// (artist — venue) instead of the featured card's multi-line venue/tour/setlist stack.
function RecentShowRow({ show }) {
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

            <div className="flex-1 min-w-0 p-4 flex items-center">
                <p className="text-sm truncate">
                    <span className="font-semibold" style={{ color: 'var(--p-color-primary)' }}>{show.artist_name}</span>
                    {show.venues && (
                        <span style={{ color: 'var(--p-color-contrast-medium)' }}>
                            {' — '}{show.venues.city}{show.venues.state_country ? `, ${show.venues.state_country}` : ''}
                        </span>
                    )}
                </p>
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
    const [show, setShow] = useState(null);
    const [otherRecent, setOtherRecent] = useState([]);
    const [songs, setSongs] = useState([]);
    const [totalSongs, setTotalSongs] = useState(0);
    const [liveDebutIds, setLiveDebutIds] = useState(new Set());
    const [tourDebutIds, setTourDebutIds] = useState(new Set());
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

                // shows is already newest-first, so the first one with songs wins. A show
                // with no setlist logged yet hasn't really been "covered" as most recent —
                // showing it here would read as if it's already happened and been
                // documented, when it might not even have happened yet (e.g. a show dated
                // today, before showtime). Render nothing rather than feature it.
                const chosen = shows.find(s => byShow[s.id]?.length);
                if (!chosen) { if (!cancelled) setLoading(false); return; }
                const rows = byShow[chosen.id] || [];

                if (cancelled) return;
                setShow(chosen);
                setOtherRecent(shows.filter(s => s.id !== chosen.id).slice(0, OTHER_RECENT_SHOWS));
                setSongs(orderSetlistSongs(rows));
                setTotalSongs(rows.length);

                getShowDebuts(chosen.id)
                    .then(data => {
                        if (cancelled) return;
                        setLiveDebutIds(new Set(data.live_debut_song_ids || []));
                        setTourDebutIds(new Set(data.tour_debut_song_ids || []));
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

    if (!show) return null;

    const [y, m, d] = show.show_date.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const monthStr = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
    const dayNum = parseInt(d, 10);

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 mb-4">
            <h2 className="font-display font-bold text-base mb-4" style={{ color: 'var(--p-color-primary)' }}>
                Most Recent Shows
            </h2>

            <Link
                to={buildShowPath(show)}
                className="flex rounded-xl border border-white/5 bg-white/[0.03] hover:border-amber-500/20 hover:bg-white/[0.06] hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 transition-all duration-150 overflow-hidden group"
            >
                {/* Date column — mirrors the search result rows */}
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

            {otherRecent.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                    {otherRecent.map(s => <RecentShowRow key={s.id} show={s} />)}
                </div>
            )}
        </div>
    );
}
