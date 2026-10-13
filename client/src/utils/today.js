// The viewer's own local calendar date as 'YYYY-MM-DD' — NOT
// `new Date().toISOString().slice(0, 10)`, which is today's date in UTC.
// For anyone in a negative-UTC-offset timezone (all of North America),
// `toISOString()` starts reporting tomorrow's UTC date as "today" once local
// time crosses UTC midnight (~8pm Eastern, ~5pm Pacific) — any show dated
// tomorrow (a plain, timezone-less show_date) then wrongly compares as
// "today or earlier" for the rest of that evening. Mirrors the same
// local-y/m/d-reconstruction fix already used by this app's formatDate
// helpers, just for "today" instead of a stored date string.
export function getLocalDateString(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
