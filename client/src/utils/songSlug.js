// Duplicated across client/src/utils/showSlug.js, tourSlug.js,
// server/utils/showMeta.js, tourMeta.js, songMeta.js and server/routes/sitemap.js
// — keep all in sync.
export function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Returns the full path: /songs/{slug}
export function buildSongPath(title) {
    return `/songs/${slugify(title)}`;
}
