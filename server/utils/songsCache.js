// Shared in-memory cache for GET /api/songs's response — that route fetches
// every song plus every setlist_songs row (often 10k+) to compute
// performance counts, genuine CPU work repeated on every call otherwise.
// Lives here rather than inside server/routes/songs.js because
// server/routes/albums.js also needs to invalidate it: adding/removing/
// reordering an album's tracks changes the album_songs data GET /api/songs
// embeds per song, even though it never touches the songs table itself.
const TTL_MS = 90 * 1000;
let cache = null; // { data, expiresAt }

function getSongsCache() {
    if (cache && cache.expiresAt > Date.now()) return cache.data;
    return null;
}

function setSongsCache(data) {
    cache = { data, expiresAt: Date.now() + TTL_MS };
}

function invalidateSongsCache() {
    cache = null;
}

module.exports = { getSongsCache, setSongsCache, invalidateSongsCache };
