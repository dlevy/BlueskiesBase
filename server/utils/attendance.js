const { supabase } = require('../config/supabase');
const { computeDebutsForShows } = require('./debuts');

/**
 * Every song performed at any of the given shows, deduped to one entry per song with
 * a playCount of how many of those shows it appeared at (not raw performance rows —
 * a song jammed out of and back into one show still only counts once for that show).
 * Shared by the personal stats route (own attended shows) and the public profile
 * route (a target user's attended shows), so both use the same reduction.
 * Excludes performance_type='dj'/'soundcheck' rows — a DJ spin or a soundcheck
 * song isn't a performance you "saw", for the same reason both are excluded
 * from debut/rarity stats.
 */
async function computeSongsSeenForShows(showIds) {
    if (!showIds || showIds.length === 0) return [];

    let allSetlistSongs = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: setlistSongs, error } = await supabase
            .from('setlist_songs')
            .select(`
                song_id,
                show_id,
                performance_type,
                songs!setlist_songs_song_id_fkey (
                    id,
                    title,
                    is_original,
                    is_sunday_valley,
                    original_artist
                )
            `)
            .in('show_id', showIds)
            .not('performance_type', 'in', '(dj,soundcheck)')
            .order('id')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw new Error('Failed to fetch songs for shows: ' + error.message);

        if (setlistSongs && setlistSongs.length > 0) {
            allSetlistSongs = allSetlistSongs.concat(setlistSongs);
            page++;
            hasMore = setlistSongs.length === pageSize;
        } else {
            hasMore = false;
        }
    }

    const songPlayCount = new Map();
    allSetlistSongs.forEach(ss => {
        if (!ss.songs) return;
        if (!songPlayCount.has(ss.song_id)) {
            songPlayCount.set(ss.song_id, {
                ...ss.songs,
                playCount: 1,
                showIds: new Set([ss.show_id]),
            });
        } else {
            const existing = songPlayCount.get(ss.song_id);
            if (!existing.showIds.has(ss.show_id)) {
                existing.playCount++;
                existing.showIds.add(ss.show_id);
            }
        }
    });

    return Array.from(songPlayCount.values()).map(song => {
        const { showIds: _showIds, ...songData } = song;
        return songData;
    });
}

/**
 * Live/tour debuts witnessed, with song title + the date/show they were witnessed at
 * (not just a count). Used by the public profile page; `pastShows` must be full show
 * objects (id + show_date, from the same set passed to computeSongsSeenForShows) and
 * `songsSeen` its already-computed companion, so song titles can be resolved without
 * a second fetch.
 */
async function computeDebutDetails(pastShows, songsSeen) {
    const showsById = {};
    pastShows.forEach(s => { showsById[s.id] = s; });
    const songsById = {};
    songsSeen.forEach(s => { songsById[s.id] = s; });

    const liveDebuts = [];
    const tourDebuts = [];
    try {
        const debutsByShow = await computeDebutsForShows(pastShows.map(s => s.id));
        Object.entries(debutsByShow).forEach(([showId, d]) => {
            const show = showsById[showId] || null;
            d.live_debut_song_ids.forEach(songId => {
                liveDebuts.push({ songId, title: songsById[songId]?.title || null, showId, showDate: show?.show_date || null, show });
            });
            d.tour_debut_song_ids.forEach(songId => {
                tourDebuts.push({ songId, title: songsById[songId]?.title || null, showId, showDate: show?.show_date || null, show });
            });
        });
    } catch (err) {
        console.error('[computeDebutDetails] Error computing debuts witnessed:', err);
    }

    liveDebuts.sort((a, b) => (b.showDate || '').localeCompare(a.showDate || ''));
    tourDebuts.sort((a, b) => (b.showDate || '').localeCompare(a.showDate || ''));

    return { liveDebuts, tourDebuts };
}

module.exports = { computeSongsSeenForShows, computeDebutDetails };
