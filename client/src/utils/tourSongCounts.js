import { supabase } from '../services/supabase';
import { getStateName, getCountry } from './geography';
import { getLocalDateString } from './today';

// Sentinel tourName for "every show, regardless of tour" — also doubles as
// its own dropdown label. A real tour literally named this isn't a realistic
// collision risk for this catalog.
export const ALL_SHOWS = 'All Shows';

// The tour of the most recent show that's actually happened — same "current tour"
// definition used by the homepage widget, so the dedicated tour stats page defaults
// to the same tour it links out from.
export async function fetchDefaultTourName() {
    const todayStr = getLocalDateString();
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

// Every distinct tour_name with at least `minShows` scheduled shows, with its date
// range, newest-last-show-first. Default (5) filters out one-off/benefit shows
// entered with their own "tour" name, for the public tour picker; admin screens
// that need to see every tour regardless of size pass minShows: 0.
// Paginated with a stable order since the shows table can exceed PostgREST's
// 1000-row default.
const MIN_TOUR_SHOWS = 5;

export async function fetchTourList({ minShows = MIN_TOUR_SHOWS } = {}) {
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
        .filter(t => t.showCount >= minShows)
        .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

// Distinct-show play counts per song title for every already-played show (show_date
// <= today) on a tour, sorted most- to least-played. Paginated with a stable order
// so repeated fetches return consistent results (see [[pagination-determinism]]).
// Excludes performance_type='dj'/'soundcheck' rows, same treatment as the server's
// equivalent tour-rarity computation (GET /api/shows/:id/tour-rarity) — neither is
// an actual live performance, so neither should count here either.
export async function fetchTourSongCounts(tourName, { stateFilter, countryFilter } = {}) {
    const todayStr = getLocalDateString();

    // venues included for the Tour Map (ShowMapShare, same shape it already
    // reads off a user's attended/upcoming shows) — otherwise unused here.
    const selectCols = 'id, show_date, venues ( id, name, city, state_country, latitude, longitude )';
    let tourShows;
    if (tourName === ALL_SHOWS) {
        // No tour_name filter at all — includes one-off/benefit shows that
        // have no tour_name too. Paginated since this can exceed PostgREST's
        // 1000-row default, unlike a single tour's show list.
        let rows = [];
        for (let rangeStart = 0; ;) {
            const { data: page, error } = await supabase
                .from('shows')
                .select(selectCols)
                .order('show_date')
                .order('id')
                .range(rangeStart, rangeStart + 999);
            if (error || !page?.length) break;
            rows = rows.concat(page);
            if (page.length < 1000) break;
            rangeStart += 1000;
        }
        tourShows = rows;
    } else {
        const { data, error: tourError } = await supabase
            .from('shows')
            .select(selectCols)
            .eq('tour_name', tourName)
            .order('show_date')
            .order('id');
        if (tourError) return null;
        tourShows = data;
    }

    if (!tourShows?.length) return null;

    if (stateFilter) tourShows = tourShows.filter(s => getStateName(s.venues?.state_country) === stateFilter);
    if (countryFilter) tourShows = tourShows.filter(s => getCountry(s.venues?.state_country) === countryFilter);
    if (!tourShows.length) return null;

    const played = tourShows.filter(s => s.show_date <= todayStr);
    const upcoming = tourShows.filter(s => s.show_date > todayStr);
    const playedIds = played.map(s => s.id);

    if (playedIds.length === 0) {
        return { totalShows: tourShows.length, playedShows: 0, firstDate: tourShows[0].show_date, lastDate: tourShows[tourShows.length - 1].show_date, playedIds: [], songCounts: [], openingSongs: [], closingSongs: [], pastShows: played, upcomingShows: upcoming };
    }

    let rows = [];
    for (let rangeStart = 0; ;) {
        const { data: page, error } = await supabase
            .from('setlist_songs')
            .select(`
                song_id, show_id, set_number, is_encore, song_order,
                songs!setlist_songs_song_id_fkey (
                    title, is_original,
                    album_songs ( albums ( title, release_date ) )
                )
            `)
            .in('show_id', playedIds)
            .not('performance_type', 'in', '(dj,soundcheck)')
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
    // Distinct songs per show (for the average), and one representative row per
    // song_id (for the tour-wide album breakdown) — both keyed off song_id so a
    // sandwiched song still only counts once per show / once tour-wide.
    const songIdsByShow = {};
    const songMetaById = {};
    // Distinct shows per song_id — same idea as showSetsByTitle above, but
    // keyed by id (not title) so the album breakdown's per-song play count
    // can't be thrown off by two different songs sharing a title.
    const showSetsBySongId = {};
    rows.forEach(r => {
        const title = r.songs?.title;
        if (title) {
            (showSetsByTitle[title] ||= new Set()).add(r.show_id);
            if (r.songs?.is_original === false) isOriginalByTitle[title] = false;
            else if (!(title in isOriginalByTitle)) isOriginalByTitle[title] = r.songs?.is_original ?? true;
        }

        if (r.song_id) {
            (songIdsByShow[r.show_id] ||= new Set()).add(r.song_id);
            (showSetsBySongId[r.song_id] ||= new Set()).add(r.show_id);
            if (!songMetaById[r.song_id]) {
                songMetaById[r.song_id] = { isOriginal: r.songs?.is_original, albumSongs: r.songs?.album_songs || [] };
            }
        }
    });

    // Opener/closer: the earliest/latest performed song per show, ordered
    // set1 < set2 < set3 < encore and by song_order within a set — not just
    // set1/song_order 1, since an incomplete or oddly-logged setlist might
    // not start there. One opener and one closer per show, so no sandwich
    // double-counting to worry about here (unlike songCounts above).
    const orderKey = r => (r.is_encore ? 4 : r.set_number) * 10000 + r.song_order;
    const openerByShow = {};
    const closerByShow = {};
    rows.forEach(r => {
        if (r.set_number == null || r.song_order == null) return;
        const key = orderKey(r);
        const opener = openerByShow[r.show_id];
        if (!opener || key < opener.key) openerByShow[r.show_id] = { row: r, key };
        const closer = closerByShow[r.show_id];
        if (!closer || key > closer.key) closerByShow[r.show_id] = { row: r, key };
    });

    function tallyByTitle(byShow) {
        const counts = {};
        Object.values(byShow).forEach(({ row }) => {
            const title = row.songs?.title;
            if (!title) return;
            const entry = (counts[title] ||= { title, count: 0, isOriginal: row.songs?.is_original });
            entry.count++;
        });
        return Object.values(counts).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
    }

    const openingSongs = tallyByTitle(openerByShow);
    const closingSongs = tallyByTitle(closerByShow);

    const showsWithSetlist = Object.keys(songIdsByShow).length;

    // Same "rare" threshold and denominator as the show page's per-song Rare badge:
    // played at fewer than 15% of tour shows that actually have a setlist logged
    // (not every scheduled show — most of a tour is still-unplayed future dates).
    const songCounts = Object.entries(showSetsByTitle)
        .map(([title, shows]) => ({
            title,
            count: shows.size,
            isOriginal: isOriginalByTitle[title],
            isRare: showsWithSetlist > 0 && shows.size / showsWithSetlist < 0.15,
        }))
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

    const totalSongInstances = Object.values(songIdsByShow).reduce((sum, set) => sum + set.size, 0);
    const avgSongsPerShow = showsWithSetlist > 0 ? totalSongInstances / showsWithSetlist : 0;

    // Album breakdown across the whole tour: a song with a real album_songs
    // association is attributed to its earliest-released album (same rule as
    // the per-show breakdown on the show page) regardless of is_original — a
    // cover that's an actual album track (several on Mutiny After Midnight,
    // for instance) counts toward that album, not the generic Covers bucket.
    // Summed by total distinct-show play count, not just whether it was
    // played at all, so an album with one song played 15 times outweighs one
    // with three songs played once each. Only a song with no album
    // association at all falls through to otherOriginals/covers.
    const albumCounts = new Map();
    let otherOriginals = 0;
    let covers = 0;
    Object.entries(songMetaById).forEach(([songId, { isOriginal, albumSongs }]) => {
        const playCount = showSetsBySongId[songId]?.size || 0;
        const assocs = (albumSongs || []).filter(as => as.albums);
        if (assocs.length > 0) {
            const primary = [...assocs].sort((a, b) => {
                const ra = a.albums?.release_date || '';
                const rb = b.albums?.release_date || '';
                if (!ra) return 1;
                if (!rb) return -1;
                return ra.localeCompare(rb);
            })[0];
            const albumTitle = primary.albums?.title || 'Other';
            albumCounts.set(albumTitle, (albumCounts.get(albumTitle) || 0) + playCount);
        } else if (isOriginal === false) {
            covers += playCount;
        } else {
            otherOriginals += playCount;
        }
    });
    const albumBreakdown = [...albumCounts.entries()]
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count);

    return {
        totalShows: tourShows.length,
        playedShows: played.length,
        showsWithSetlist,
        firstDate: tourShows[0].show_date,
        lastDate: tourShows[tourShows.length - 1].show_date,
        playedIds,
        songCounts,
        openingSongs,
        closingSongs,
        avgSongsPerShow,
        albumBreakdown,
        otherOriginals,
        covers,
        pastShows: played,
        upcomingShows: upcoming,
    };
}
