import { supabase } from '../services/supabase';

// The tour of the most recent show that's actually happened — same "current tour"
// definition used by the homepage widget, so the dedicated tour stats page defaults
// to the same tour it links out from.
export async function fetchDefaultTourName() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
        .from('shows')
        .select('tour_name')
        .lte('show_date', todayStr)
        .not('tour_name', 'is', null)
        .order('show_date', { ascending: false })
        .order('id')
        .limit(1);
    return data?.[0]?.tour_name || null;
}

// Every distinct tour_name with at least MIN_TOUR_SHOWS scheduled shows, with its
// date range, newest-last-show-first — for a tour picker. Filters out one-off/benefit
// shows entered with their own "tour" name so the list stays to actual tours.
// Paginated with a stable order since the shows table can exceed PostgREST's
// 1000-row default.
const MIN_TOUR_SHOWS = 5;

export async function fetchTourList() {
    let rows = [];
    for (let rangeStart = 0; ;) {
        const { data: page, error } = await supabase
            .from('shows')
            .select('tour_name, show_date')
            .not('tour_name', 'is', null)
            .order('id')
            .range(rangeStart, rangeStart + 999);
        if (error || !page?.length) break;
        rows = rows.concat(page);
        if (page.length < 1000) break;
        rangeStart += 1000;
    }

    const byTour = {};
    rows.forEach(({ tour_name, show_date }) => {
        if (!tour_name) return;
        const entry = (byTour[tour_name] ||= { tourName: tour_name, firstDate: show_date, lastDate: show_date, showCount: 0 });
        entry.showCount++;
        if (show_date < entry.firstDate) entry.firstDate = show_date;
        if (show_date > entry.lastDate) entry.lastDate = show_date;
    });

    return Object.values(byTour)
        .filter(t => t.showCount >= MIN_TOUR_SHOWS)
        .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

// Distinct-show play counts per song title for every already-played show (show_date
// <= today) on a tour, sorted most- to least-played. Paginated with a stable order
// so repeated fetches return consistent results (see [[pagination-determinism]]).
export async function fetchTourSongCounts(tourName) {
    const todayStr = new Date().toISOString().slice(0, 10);

    const { data: tourShows, error: tourError } = await supabase
        .from('shows')
        .select('id, show_date')
        .eq('tour_name', tourName)
        .order('show_date')
        .order('id');

    if (tourError || !tourShows?.length) return null;

    const played = tourShows.filter(s => s.show_date <= todayStr);
    const playedIds = played.map(s => s.id);

    if (playedIds.length === 0) {
        return { totalShows: tourShows.length, playedShows: 0, firstDate: tourShows[0].show_date, lastDate: tourShows[tourShows.length - 1].show_date, playedIds: [], songCounts: [] };
    }

    let rows = [];
    for (let rangeStart = 0; ;) {
        const { data: page, error } = await supabase
            .from('setlist_songs')
            .select('song_id, show_id, songs!setlist_songs_song_id_fkey(title, is_original)')
            .in('show_id', playedIds)
            .order('id')
            .range(rangeStart, rangeStart + 999);
        if (error || !page?.length) break;
        rows = rows.concat(page);
        if (page.length < 1000) break;
        rangeStart += 1000;
    }

    // Distinct shows per song — a song sandwiched (jammed out of and back into)
    // within one show still only counts once for that show.
    const showSetsByTitle = {};
    const isOriginalByTitle = {};
    rows.forEach(r => {
        const title = r.songs?.title;
        if (!title) return;
        (showSetsByTitle[title] ||= new Set()).add(r.show_id);
        if (r.songs?.is_original === false) isOriginalByTitle[title] = false;
        else if (!(title in isOriginalByTitle)) isOriginalByTitle[title] = r.songs?.is_original ?? true;
    });

    const songCounts = Object.entries(showSetsByTitle)
        .map(([title, shows]) => ({ title, count: shows.size, isOriginal: isOriginalByTitle[title] }))
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

    return {
        totalShows: tourShows.length,
        playedShows: played.length,
        firstDate: tourShows[0].show_date,
        lastDate: tourShows[tourShows.length - 1].show_date,
        playedIds,
        songCounts,
    };
}
