// <input type="datetime-local"> both reads and writes a timezone-less local
// string ("YYYY-MM-DDTHH:mm"), so a stored UTC ISO string needs converting
// to the browser's local time to populate the field, and back to a real UTC
// instant (via `new Date(localString).toISOString()`, since a
// timezone-less string is parsed as local time) when saving.
export function toDatetimeLocalValue(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
