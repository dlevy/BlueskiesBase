/**
 * Orders raw setlist_songs rows the way the show page does — encores last, then
 * set number, then position within the set — and returns just the titles.
 * Rows can arrive unordered (they're fetched in paginated batches), so never
 * rely on the order the database happened to return.
 */
export function orderSetlistTitles(rows) {
    return [...rows]
        .sort((a, b) =>
            (a.is_encore ? 1 : 0) - (b.is_encore ? 1 : 0) ||
            (a.set_number ?? 0) - (b.set_number ?? 0) ||
            (a.song_order ?? 0) - (b.song_order ?? 0)
        )
        .map(r => r.songs?.title)
        .filter(Boolean);
}
