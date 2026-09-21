const { supabase } = require('../config/supabase');

// This does a couple of full-table scans (every setlist_songs row, every show) and
// takes ~3s — fine for one page load, but it's called independently by both the
// public song-stats endpoint and the personal stats endpoint, and would otherwise
// re-run that full scan on every single request to either. A short in-memory cache
// (persists for the lifetime of a warm server/serverless instance) means only the
// first caller in a given window pays the cost.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // rarestLimit -> { data, expiresAt }

/**
 * All-time per-song play counts (distinct shows, not raw setlist rows), split into
 * covers/originals, each sorted most- to least-played. Shared by the public global
 * song stats endpoint and the personal stats endpoint (for "rare songs you've seen"),
 * so both agree on exactly the same all-time rarity ranking.
 * `rarestLimit` controls how many of the least-played songs are returned per bucket —
 * ranked, not percentage-based, since a percentage of all-time shows played would
 * unfairly flag recently-debuted songs as "rare" just for not having existed during
 * earlier tours (same issue already fixed for the per-tour Rare badge).
 */
async function computeGlobalSongStats(rarestLimit = 10) {
    const cached = cache.get(rarestLimit);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    let allSetlistSongs = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: batch, error: batchError } = await supabase
            .from('setlist_songs')
            .select(`
                show_id,
                song_id,
                performance_type,
                songs!setlist_songs_song_id_fkey (
                    id,
                    title,
                    is_original,
                    original_artist,
                    album_id
                )
            `)
            .order('id')
            .range(from, from + batchSize - 1);

        if (batchError) throw new Error('Failed to fetch setlist songs: ' + batchError.message);

        if (batch && batch.length > 0) {
            allSetlistSongs = allSetlistSongs.concat(batch);
            from += batchSize;
            hasMore = batch.length === batchSize;
        } else {
            hasMore = false;
        }
    }

    let shows = [];
    for (let rangeStart = 0; ;) {
        const { data: page, error: showsError } = await supabase
            .from('shows')
            .select('id, show_date')
            .order('id')
            .range(rangeStart, rangeStart + 999);

        if (showsError) throw new Error('Failed to fetch show dates: ' + showsError.message);
        shows = shows.concat(page || []);
        if (!page || page.length < 1000) break;
        rangeStart += 1000;
    }

    const showDates = {};
    shows.forEach(show => { showDates[show.id] = show.show_date; });

    const songPlayCounts = {};
    allSetlistSongs.forEach(ss => {
        if (!ss.songs) return;

        const songId = ss.songs.id;
        const showId = ss.show_id;
        const showDate = showDates[showId];
        if (!showDate) return;

        if (!songPlayCounts[songId]) {
            songPlayCounts[songId] = {
                id: songId,
                title: ss.songs.title,
                is_original: ss.songs.is_original,
                original_artist: ss.songs.original_artist,
                shows: new Set(),
                lastPlayed: showDate,
            };
        }
        songPlayCounts[songId].shows.add(showId);
        if (new Date(showDate) > new Date(songPlayCounts[songId].lastPlayed)) {
            songPlayCounts[songId].lastPlayed = showDate;
        }
    });

    const songsWithCounts = Object.values(songPlayCounts).map(song => ({
        id: song.id,
        title: song.title,
        is_original: song.is_original,
        original_artist: song.original_artist,
        playCount: song.shows.size,
        lastPlayed: song.lastPlayed,
    }));

    const covers = songsWithCounts.filter(s => s.is_original === false);
    const originals = songsWithCounts.filter(s => s.is_original === true);

    covers.sort((a, b) => b.playCount - a.playCount);
    originals.sort((a, b) => b.playCount - a.playCount);

    const result = {
        covers: {
            total: covers.length,
            top5: covers.slice(0, 5),
            rarest: covers.slice(-rarestLimit).reverse(),
        },
        originals: {
            total: originals.length,
            top5: originals.slice(0, 5),
            rarest: originals.slice(-rarestLimit).reverse(),
        },
    };

    cache.set(rarestLimit, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
}

module.exports = { computeGlobalSongStats };
