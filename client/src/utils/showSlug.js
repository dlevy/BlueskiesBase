export function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// UUID without dashes is 32 hex chars — safe to embed in a dash-separated slug
export function buildShowSlug(show) {
    const parts = [show.show_date];
    if (show.artist_name) parts.push(slugify(show.artist_name));
    if (show.venues?.name) parts.push(slugify(show.venues.name));
    if (show.venues?.city) parts.push(slugify(show.venues.city));
    if (show.venues?.state_country) parts.push(slugify(show.venues.state_country));
    parts.push(String(show.id).replace(/-/g, '')); // UUID without dashes
    return parts.join('-');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPACT_UUID_RE = /([0-9a-f]{32})$/i;

// Handles: raw UUID, compact UUID at end of slug, or legacy integer
export function extractShowId(slugOrId) {
    const str = String(slugOrId);

    // Already a full UUID (e.g. legacy direct links)
    if (UUID_RE.test(str)) return str;

    // Compact UUID (32 hex chars) at the end of a friendly slug
    const match = str.match(COMPACT_UUID_RE);
    if (match) {
        const h = match[1];
        return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    }

    // Legacy integer ID
    return str;
}
