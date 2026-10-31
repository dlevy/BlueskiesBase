// Duplicated across client/src/utils/showSlug.js, server/utils/showMeta.js,
// server/utils/tourMeta.js and server/routes/sitemap.js — keep all five in sync.
export function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Returns the full path: /tours/{slug}
export function buildTourPath(tourName) {
    return `/tours/${slugify(tourName)}`;
}
