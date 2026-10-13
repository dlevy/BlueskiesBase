const { supabase } = require('../config/supabase');
const { computeSetlistIndex } = require('./setlistIndex');

/**
 * Computes live-debut and tour-debut song ids for a batch of shows in as few queries as
 * possible, regardless of whether it's called with one show_id or hundreds.
 *   - live: played live for the very first time ever, at that show.
 *   - tour: played for the first time on that show's tour (tour_name), but not a live
 *     debut — i.e. an older song making its first appearance this tour.
 * A live debut is necessarily also a tour debut, but is excluded from the tour list so a
 * song is only ever tagged with the stronger claim.
 * "First performance" always means the earliest setlist_songs date for that song — never
 * the song's catalog created_at, which just reflects when it was entered (e.g. every song
 * off a new album gets bulk-added to the catalog on release day, regardless of whether or
 * when any of them are actually performed live). Rows with performance_type='dj' (an
 * afterparty-style DJ spin) or 'soundcheck' (not performed during the actual show) are
 * excluded entirely — both from "was this song played at this show" and from the
 * earliest-date math, so neither ever wrongly claims a debut or blocks a later real one.
 * Returns { [show_id]: { live_debut_song_ids: [...], tour_debut_song_ids: [...] } } — every
 * requested show_id is present, with empty arrays for a show with no setlist or that
 * doesn't exist (callers that need to distinguish "doesn't exist" should check separately).
 */
async function computeDebutsForShows(showIds) {
    const result = {};
    showIds.forEach(id => { result[id] = { live_debut_song_ids: [], tour_debut_song_ids: [] }; });
    if (showIds.length === 0) return result;

    const { data: shows, error: showsError } = await supabase
        .from('shows')
        .select('id, show_date, tour_name')
        .in('id', showIds);
    if (showsError) throw new Error('Failed to load shows: ' + showsError.message);

    const showMeta = {};
    (shows || []).forEach(s => { showMeta[s.id] = s; });

    // Songs played at each show in the batch. Paginated — a large batch (e.g. a broad
    // search result) can easily exceed PostgREST's 1000-row default.
    let batchSongs = [];
    for (let rangeStart = 0; ;) {
        const { data: page, error } = await supabase
            .from('setlist_songs')
            .select('show_id, song_id')
            .in('show_id', showIds)
            .not('song_id', 'is', null)
            .not('performance_type', 'in', '(dj,soundcheck)')
            .order('id')
            .range(rangeStart, rangeStart + 999);
        if (error) throw new Error('Failed to load setlists for batch: ' + error.message);
        batchSongs = batchSongs.concat(page || []);
        if (!page || page.length < 1000) break;
        rangeStart += 1000;
    }

    const songsByShow = {};
    batchSongs.forEach(({ show_id, song_id }) => {
        (songsByShow[show_id] ||= new Set()).add(song_id);
    });

    if (batchSongs.length === 0) return result;

    // Every song's true earliest performance date, globally and per-tour, from the
    // shared cached index — instead of this function re-scanning every performance of
    // every involved song itself, and instead of a separate query per distinct tour
    // (both of which this used to do here; see setlistIndex.js's own comment for why
    // that was expensive enough to matter).
    const index = await computeSetlistIndex();

    showIds.forEach(showId => {
        const meta = showMeta[showId];
        if (!meta) return; // leaves the default empty arrays already set above
        const songsHere = [...(songsByShow[showId] || [])];
        const live = songsHere.filter(songId => index.globalEarliestBySong.get(songId) === meta.show_date);
        const liveSet = new Set(live);
        const tourEarliestForTour = meta.tour_name ? index.tourEarliestBySongTour.get(meta.tour_name) : null;
        const tour = tourEarliestForTour
            ? songsHere.filter(songId => !liveSet.has(songId) && tourEarliestForTour.get(songId) === meta.show_date)
            : [];
        result[showId] = { live_debut_song_ids: live, tour_debut_song_ids: tour };
    });

    return result;
}

module.exports = { computeDebutsForShows };
