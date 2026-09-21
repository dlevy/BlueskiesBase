const { supabase } = require('../config/supabase');

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
 * when any of them are actually performed live).
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

    const songIdsInvolved = [...new Set(batchSongs.map(r => r.song_id))];
    if (songIdsInvolved.length === 0) return result;

    // Every performance, anywhere, of any song played by any show in the batch — to find
    // each song's true earliest date, both globally and within whichever tour(s) are
    // involved. Paginated for the same reason as above.
    let performances = [];
    for (let rangeStart = 0; ;) {
        const { data: page, error } = await supabase
            .from('setlist_songs')
            .select('song_id, show_id, shows(show_date)')
            .in('song_id', songIdsInvolved)
            .order('id')
            .range(rangeStart, rangeStart + 999);
        if (error) throw new Error('Failed to compute debuts: ' + error.message);
        performances = performances.concat(page || []);
        if (!page || page.length < 1000) break;
        rangeStart += 1000;
    }

    // Live debut: earliest performance anywhere, ever.
    const globalEarliest = {};
    performances.forEach(({ song_id, shows: performedShow }) => {
        const d = performedShow?.show_date;
        if (!d) return;
        if (!globalEarliest[song_id] || d < globalEarliest[song_id]) globalEarliest[song_id] = d;
    });

    // Tour debut: earliest performance within shows sharing a tour_name. Needs the FULL
    // show list for every distinct tour touched by the batch, not just the batch's own
    // shows — a song's earliest tour performance can easily be at a show outside whatever
    // subset (e.g. a search result page) we were asked about.
    const tourNames = [...new Set(Object.values(showMeta).map(s => s.tour_name).filter(Boolean))];
    const showIdToTour = {};
    for (const tourName of tourNames) {
        const { data: tourShows, error } = await supabase.from('shows').select('id').eq('tour_name', tourName);
        if (error) throw new Error('Failed to load tour shows: ' + error.message);
        (tourShows || []).forEach(s => { showIdToTour[s.id] = tourName; });
    }

    const tourEarliest = {}; // tourName -> { song_id: date }
    performances.forEach(({ song_id, show_id, shows: performedShow }) => {
        const tourName = showIdToTour[show_id];
        if (!tourName) return;
        const d = performedShow?.show_date;
        if (!d) return;
        const forTour = (tourEarliest[tourName] ||= {});
        if (!forTour[song_id] || d < forTour[song_id]) forTour[song_id] = d;
    });

    showIds.forEach(showId => {
        const meta = showMeta[showId];
        if (!meta) return; // leaves the default empty arrays already set above
        const songsHere = [...(songsByShow[showId] || [])];
        const live = songsHere.filter(songId => globalEarliest[songId] === meta.show_date);
        const liveSet = new Set(live);
        const tour = meta.tour_name
            ? songsHere.filter(songId => !liveSet.has(songId) && tourEarliest[meta.tour_name]?.[songId] === meta.show_date)
            : [];
        result[showId] = { live_debut_song_ids: live, tour_debut_song_ids: tour };
    });

    return result;
}

module.exports = { computeDebutsForShows };
