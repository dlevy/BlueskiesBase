const { supabase } = require('../config/supabase');
const { computeDebutsForShows } = require('./debuts');
const { computeGlobalSongStats } = require('./songStats');

/**
 * Every song performed at any of the given shows, deduped to one entry per song with
 * a playCount of how many of those shows it appeared at (not raw performance rows —
 * a song jammed out of and back into one show still only counts once for that show).
 * Shared by the personal stats route (own attended shows) and the public profile
 * route (a target user's attended shows), so both use the same reduction.
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
                    original_artist
                )
            `)
            .in('show_id', showIds)
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
 * Live/tour debuts witnessed at a set of a user's past attended shows. Shared by the
 * personal stats route and the public profile route so both agree on the same
 * definition (same debut utility either way).
 */
async function computeDebutCounts(pastShowIds) {
    let liveDebutsWitnessed = 0;
    let tourDebutsWitnessed = 0;
    try {
        const debutsByShow = await computeDebutsForShows(pastShowIds);
        Object.values(debutsByShow).forEach(d => {
            liveDebutsWitnessed += d.live_debut_song_ids.length;
            tourDebutsWitnessed += d.tour_debut_song_ids.length;
        });
    } catch (err) {
        console.error('[computeDebutCounts] Error computing debuts witnessed:', err);
    }
    return { liveDebutsWitnessed, tourDebutsWitnessed };
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
            const show = showsById[showId];
            d.live_debut_song_ids.forEach(songId => {
                liveDebuts.push({ songId, title: songsById[songId]?.title || null, showId, showDate: show?.show_date || null });
            });
            d.tour_debut_song_ids.forEach(songId => {
                tourDebuts.push({ songId, title: songsById[songId]?.title || null, showId, showDate: show?.show_date || null });
            });
        });
    } catch (err) {
        console.error('[computeDebutDetails] Error computing debuts witnessed:', err);
    }

    liveDebuts.sort((a, b) => (b.showDate || '').localeCompare(a.showDate || ''));
    tourDebuts.sort((a, b) => (b.showDate || '').localeCompare(a.showDate || ''));

    return { liveDebuts, tourDebuts };
}

/**
 * How many all-time-rarest songs a user has seen (and the single rarest match), given
 * their already-computed songsSeen list. Used by the personal stats route only — the
 * public profile page doesn't surface this.
 */
async function computeRarityCounts(songsSeen) {
    let rareSongsSeenCount = 0;
    let rarestSongSeen = null;
    try {
        const globalStats = await computeGlobalSongStats(10);
        const rarestSongs = [...globalStats.originals.rarest, ...globalStats.covers.rarest];
        const rareSongIds = new Set(rarestSongs.map(s => s.id));
        const seenRare = songsSeen.filter(s => rareSongIds.has(s.id));
        rareSongsSeenCount = seenRare.length;
        if (seenRare.length > 0) {
            const rarestMatch = rarestSongs
                .filter(s => seenRare.some(seen => seen.id === s.id))
                .sort((a, b) => a.playCount - b.playCount)[0];
            rarestSongSeen = rarestMatch ? { title: rarestMatch.title, playCount: rarestMatch.playCount } : null;
        }
    } catch (err) {
        console.error('[computeRarityCounts] Error computing rare songs seen:', err);
    }
    return { rareSongsSeenCount, rarestSongSeen };
}

module.exports = { computeSongsSeenForShows, computeDebutCounts, computeDebutDetails, computeRarityCounts };
