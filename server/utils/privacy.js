// Shared "is this account hidden" redaction, used anywhere a joined
// `profiles` row would otherwise expose a hidden account's real username/
// display_name in a public response (comments, attendee lists, thanks).
// Hidden accounts keep working everywhere — commenting, attending, thanking
// — only their displayed identity is replaced.

/**
 * For a flattened "who did this" name (e.g. thanks.js's thankedByName).
 */
function resolveDisplayName(profile, fallback = 'Someone') {
    if (!profile) return fallback;
    if (profile.hide_from_directory) return 'Private';
    return profile.display_name || profile.username || fallback;
}

/**
 * For an embedded `profiles:xxx(...)` object kept in the response shape
 * (e.g. notes.js's note.profiles, shows.js's attendee.profiles) — strips
 * the real username/id and swaps in a generic stand-in when hidden, so a
 * client can't recover the real identity from the API response itself.
 */
function redactProfile(profile) {
    if (!profile) return profile;
    if (profile.hide_from_directory) {
        return { id: null, username: null, display_name: 'Private' };
    }
    const { hide_from_directory, ...rest } = profile;
    return rest;
}

module.exports = { resolveDisplayName, redactProfile };
