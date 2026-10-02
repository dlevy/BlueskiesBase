import { buildShowPath } from './showSlug';

// Shared between NotificationBell (header dropdown) and NotificationsPage
// (full history) so both render the same text for the same row.
export const CONTENT_LABEL = {
    photo: 'photo',
    poster: 'poster',
    note: 'comment',
    setlist_submission: 'setlist submission',
    setlist: 'setlist',
};

export function timeAgo(dateString) {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString();
}

export function notificationText(n) {
    const actorName = n.actor?.display_name || n.actor?.username || 'Someone';
    const label = CONTENT_LABEL[n.content_type] || 'contribution';

    if (n.type === 'mention') return `${actorName} mentioned you in a comment`;
    if (n.type === 'submission') return `${actorName} submitted a setlist correction for review`;
    if (n.type === 'poster_interest') return `${actorName} sent you a message about your poster listing`;
    if (n.type === 'show_update') {
        return n.content_type === 'setlist'
            ? `${actorName} updated the setlist for a show you attended`
            : `${actorName} added a new ${label} to a show you attended`;
    }
    return `${actorName} thanked you for your ${label}`;
}

export function notificationShowLabel(n) {
    if (!n.shows) return null;
    const venue = `${n.shows.venues?.city || ''}${n.shows.venues?.state_country ? `, ${n.shows.venues.state_country}` : ''}`;
    // show_date is a plain DATE column (YYYY-MM-DD) — parse the parts directly
    // rather than `new Date(dateString)`, which reads it as UTC midnight and
    // can print the wrong day in a timezone west of UTC.
    const [year, month, day] = n.shows.show_date.split('-');
    const formattedDate = new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${formattedDate} — ${n.shows.artist_name}${venue ? `, ${venue}` : ''}`;
}

// The notification's destination: the show page, deep-linked to the
// specific submission for a 'submission' notification (staff need to find
// the actual thing to review, not just land on the top of the show page).
// A 'poster_interest' notification instead links to the other party's
// profile — the point is to go find and respond to them, not revisit a show.
export function notificationLink(n) {
    if (n.type === 'poster_interest') {
        return n.actor?.username ? `/profile/${n.actor.username}` : null;
    }
    if (!n.shows) return null;
    const base = buildShowPath(n.shows);
    if (n.type === 'submission') return `${base}#submission-${n.content_id}`;
    return base;
}
