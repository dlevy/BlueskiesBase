// Mirrors client/src/utils/geography.js's formatVenueLocation — kept as a
// separate CommonJS copy since the client (ESM/Vite) and server (CommonJS/
// Node) don't share a module system in this codebase.
function formatVenueLocation(venue) {
    if (!venue) return '';
    return [venue.city, venue.state, venue.country].filter(Boolean).join(', ');
}

module.exports = { formatVenueLocation };
