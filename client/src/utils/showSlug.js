export function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function buildShowSlug(show) {
    const parts = [show.show_date];
    if (show.artist_name) parts.push(slugify(show.artist_name));
    if (show.venues?.name) parts.push(slugify(show.venues.name));
    if (show.venues?.city) parts.push(slugify(show.venues.city));
    if (show.venues?.state_country) parts.push(slugify(show.venues.state_country));
    parts.push(String(show.id));
    return parts.join('-');
}

// Handles both "2024-09-15-artist-venue-city-tn-45" and legacy "45"
export function extractShowId(slugOrId) {
    const last = String(slugOrId).split('-').pop();
    return parseInt(last, 10);
}
