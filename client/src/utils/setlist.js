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
        .map(r => ({ song_id: r.song_id, title: r.songs?.title }))
        .filter(s => s.title);
}

/**
 * Assigns the visible track number to each song in an ordered setlist, with
 * one exception: a jam's return to a song already numbered earlier in the
 * same unbroken chain (e.g. A Good Look -> Life During Wartime -> back into
 * A Good Look) doesn't get a new number — it's the same performance
 * resuming, not a new one — while a song jammed into for the first time
 * still gets the next sequential number like any other song. Numbers never
 * skip: the counter only advances for songs that actually display one.
 * Shared by the show page and the Instagram post graphic so both stay in sync.
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

        if (!isReturnWithinChain) counter++;

        return { song, position: isReturnWithinChain ? null : counter };
    });
}
