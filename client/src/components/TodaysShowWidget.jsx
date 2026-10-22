import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { getShowDebutsBatch } from '../services/api';
import { ShowCard } from './MostRecentShowWidget';
import { orderSetlistSongs } from '../utils/setlist';

// Only ever renders a show whose show_date is literally today — not "most
// recent" (which excludes today until a setlist's logged, see
// MostRecentShowWidget) and not "upcoming" (which UpcomingShowsWidget now
// excludes today from, so the same show isn't shown twice on the homepage).
export default function TodaysShowWidget() {
    const [show, setShow] = useState(null);
    const [songs, setSongs] = useState([]);
    const [totalSongs, setTotalSongs] = useState(0);
    const [debuts, setDebuts] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchTodaysShow = async () => {
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
                    .eq('show_date', todayStr)
                    .order('id')
                    .limit(1);

                if (showsError || !shows?.length) {
                    if (!cancelled) setLoading(false);
                    return;
                }
                const todaysShow = shows[0];

                const { data: setlistRows } = await supabase
                    .from('setlist_songs')
                    .select('show_id, song_id, set_number, song_order, is_encore, songs!setlist_songs_song_id_fkey(title)')
                    .eq('show_id', todaysShow.id);

                if (cancelled) return;
                setShow(todaysShow);
                setSongs(orderSetlistSongs(setlistRows || []));
                setTotalSongs((setlistRows || []).length);

                getShowDebutsBatch([todaysShow.id])
                    .then(data => { if (!cancelled) setDebuts(data); })
                    .catch(err => console.error('[TodaysShowWidget] debuts fetch failed:', err));
            } catch (err) {
                console.error('[TodaysShowWidget] Error fetching today\'s show:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchTodaysShow();
        return () => { cancelled = true; };
    }, []);

    if (loading || !show) return null;

    return (
        <div className="relative rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-[#1a1e26] to-[#1a1e26] p-5 mb-4 shadow-lg shadow-amber-500/10">
            <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
                <h2 className="font-display font-bold text-base uppercase tracking-wide" style={{ color: '#fbbf24' }}>
                    Tonight's Show
                </h2>
            </div>

            <ShowCard
                show={show}
                songs={songs}
                totalSongs={totalSongs}
                liveDebutIds={new Set(debuts[show.id]?.live_debut_song_ids || [])}
                tourDebutIds={new Set(debuts[show.id]?.tour_debut_song_ids || [])}
            />
        </div>
    );
}
