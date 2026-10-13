const { supabase } = require('../config/supabase');

// A single pass over every show + every setlist_songs row, shared by every
// feature that needs "how many times / when was this song played, globally
// or within a tour": GET /api/songs' performance counts, GET /api/users/stats'
// all-played/not-seen lists, and computeDebutsForShows' live/tour debut dates.
// Each of those used to independently re-scan the same ~6500-row table on
// every single request (measured ~1.5-2s per scan against production data) —
// this computes it once and shares it via a short TTL cache, same pattern
// already used by songsCache.js / songStats.js's own caches.
const TTL_MS = 90 * 1000;
let cache = null; // { data, expiresAt }

async function fetchAllPaginated(query) {
    let rows = [];
    for (let rangeStart = 0; ;) {
        const { data: page, error } = await query.range(rangeStart, rangeStart + 999);
        if (error) throw new Error(error.message);
        rows = rows.concat(page || []);
        if (!page || page.length < 1000) break;
        rangeStart += 1000;
    }
    return rows;
}

async function computeSetlistIndex() {
    if (cache && cache.expiresAt > Date.now()) return cache.data;

    const shows = await fetchAllPaginated(
        supabase.from('shows').select('id, show_date, tour_name').order('id')
    );
    const showDateById = new Map();
    const tourNameByShowId = new Map();
    shows.forEach(s => {
        showDateById.set(s.id, s.show_date);
        if (s.tour_name) tourNameByShowId.set(s.id, s.tour_name);
    });

    const setlistRows = await fetchAllPaginated(
        supabase
            .from('setlist_songs')
            .select('song_id, show_id')
            .not('song_id', 'is', null)
            .not('performance_type', 'in', '(dj,soundcheck)')
            .order('id')
    );

    const showIdsBySong = new Map();       // songId -> Set<showId> (size = performance_count)
    const globalEarliestBySong = new Map(); // songId -> earliest show_date
    const lastPlayedShowIdBySong = new Map(); // songId -> most recent show_id
    const lastPlayedDateBySong = new Map();
    const tourEarliestBySongTour = new Map(); // tourName -> Map<songId, earliest show_date>

    setlistRows.forEach(({ song_id, show_id }) => {
        const date = showDateById.get(show_id);
        if (!date) return;

        if (!showIdsBySong.has(song_id)) showIdsBySong.set(song_id, new Set());
        showIdsBySong.get(song_id).add(show_id);

        if (!globalEarliestBySong.has(song_id) || date < globalEarliestBySong.get(song_id)) {
            globalEarliestBySong.set(song_id, date);
        }
        if (!lastPlayedDateBySong.has(song_id) || date > lastPlayedDateBySong.get(song_id)) {
            lastPlayedDateBySong.set(song_id, date);
            lastPlayedShowIdBySong.set(song_id, show_id);
        }

        const tourName = tourNameByShowId.get(show_id);
        if (tourName) {
            if (!tourEarliestBySongTour.has(tourName)) tourEarliestBySongTour.set(tourName, new Map());
            const forTour = tourEarliestBySongTour.get(tourName);
            if (!forTour.has(song_id) || date < forTour.get(song_id)) forTour.set(song_id, date);
        }
    });

    const data = { showDateById, tourNameByShowId, showIdsBySong, globalEarliestBySong, lastPlayedShowIdBySong, tourEarliestBySongTour };
    cache = { data, expiresAt: Date.now() + TTL_MS };
    return data;
}

function invalidateSetlistIndex() {
    cache = null;
}

module.exports = { computeSetlistIndex, invalidateSetlistIndex };
