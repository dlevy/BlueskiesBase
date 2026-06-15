export function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Returns the full path: /show/{artist}/{date}/{city-state-uuid}
export function buildShowPath(show) {
    const artist = slugify(show.artist_name || '');
    const date = show.show_date;
    const locationParts = [];
    if (show.venues?.city) locationParts.push(slugify(show.venues.city));
    if (show.venues?.state_country) locationParts.push(slugify(show.venues.state_country));
    locationParts.push(String(show.id).replace(/-/g, '')); // UUID without dashes
    return `/show/${artist}/${date}/${locationParts.join('-')}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPACT_UUID_RE = /([0-9a-f]{32})$/i;

// Extracts the show UUID from the location segment (city-state-uuid) or a raw UUID
export function extractShowId(locationOrId) {
    const str = String(locationOrId);
    if (UUID_RE.test(str)) return str;
    const match = str.match(COMPACT_UUID_RE);
    if (match) {
        const h = match[1];
        return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    }
    return str;
}
