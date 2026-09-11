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
