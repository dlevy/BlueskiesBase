/**
 * Orders raw setlist_songs rows the way the show page does — encores last, then
 * set number, then position within the set — and returns {song_id, title} pairs.
 * Rows can arrive unordered (they're fetched in paginated batches), so never
 * rely on the order the database happened to return. song_id is kept (not just
 * title) so callers can cross-reference against live/tour debut id sets.
 */
export function orderSetlistSongs(rows) {
    return [...rows]
        .sort((a, b) =>
            (a.is_encore ? 1 : 0) - (b.is_encore ? 1 : 0) ||
            (a.set_number ?? 0) - (b.set_number ?? 0) ||
            (a.song_order ?? 0) - (b.song_order ?? 0)
        )
        .map(r => ({ song_id: r.song_id, title: r.songs?.title, performance_type: r.performance_type }))
        .filter(s => s.title);
}

/**
 * Assigns the visible track number to each song in an ordered setlist, with
 * two exceptions that don't get a number of their own:
 *   - a jam's return to a song already numbered earlier in the same
 *     unbroken chain (e.g. A Good Look -> Life During Wartime -> back into
 *     A Good Look) — it's the same performance resuming, not a new one —
 *     while a song jammed into for the first time still gets the next
 *     sequential number like any other song;
 *   - a tease (performance_type === 'tease') — a brief riff or musical
 *     phrase interpolated into another song, not performed as its own distinct
 *     setlist entry, so it doesn't occupy a position either. A `partial`
 *     performance is NOT included here — that's still its own distinct
 *     (if abbreviated) setlist entry, just not a full performance.
 * Numbers never skip: the counter only advances for songs that actually
 * display one. Shared by the show page and the Instagram post graphic so
 * both stay in sync.
 */
export function assignSetlistDisplayNumbers(songs) {
    let counter = 0;
    let chainSongIds = null; // song_ids seen so far in the current unbroken chain
    return songs.map((song, index) => {
        const prev = songs[index - 1];
        const continuingChain = index > 0 && prev.jams_into != null;

        if (!continuingChain) {
            chainSongIds = null;
        } else if (chainSongIds === null) {
            chainSongIds = new Set([prev.song_id]);
        }

        const isReturnWithinChain = continuingChain && song.song_id != null && chainSongIds.has(song.song_id);

        if (continuingChain && song.song_id != null && !isReturnWithinChain) {
            chainSongIds.add(song.song_id);
        }

        const skipNumber = isReturnWithinChain || song.performance_type === 'tease';

        if (!skipNumber) counter++;

        return { song, position: skipNumber ? null : counter };
    });
}

/**
 * Per-show tag counts (covers/teases/rare/live debuts/tour debuts) from raw
 * setlist_songs rows — the summary-card counterpart to ShowDetailPage's own
 * computeSetlistStats, used anywhere a show is listed without its full
 * setlist (homepage widgets, search results) so the same show reports the
 * same counts everywhere. Mirrors that function's exclusion rules exactly:
 * a tease isn't a real performance of the song, so it earns its own
 * teaseCount but never counts as a cover, rare song, or debut; a DJ'd song
 * doesn't count anywhere.
 *
 * rows: raw setlist_songs rows [{song_id, performance_type, songs: {is_original}}].
 * tourRarity: {total_shows, song_counts} from GET /shows/:id/tour-rarity, or
 * null/undefined when the show has no tour (no Rare tag is possible then).
 * liveDebutIds/tourDebutIds: Set<song_id>.
 */
export function computeShowTagCounts(rows, tourRarity, liveDebutIds, tourDebutIds) {
    const seen = new Set();
    let coverCount = 0, teaseCount = 0, rareCount = 0, liveDebutCount = 0, tourDebutCount = 0;

    (rows || []).forEach(row => {
        if (!row.song_id || seen.has(row.song_id)) return;

        if (row.performance_type === 'tease') {
            seen.add(row.song_id);
            teaseCount++;
            return;
        }
        if (row.performance_type === 'dj') {
            seen.add(row.song_id);
            return;
        }
        seen.add(row.song_id);

        if (row.songs?.is_original === false) coverCount++;

        const tourCount = tourRarity?.total_shows > 0 ? tourRarity.song_counts[row.song_id] : undefined;
        if (tourCount != null && tourCount / tourRarity.total_shows < 0.15) rareCount++;

        if (liveDebutIds?.has(row.song_id)) liveDebutCount++;
        if (tourDebutIds?.has(row.song_id)) tourDebutCount++;
    });

    return { coverCount, teaseCount, rareCount, liveDebutCount, tourDebutCount };
}
