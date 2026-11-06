import { buildShowPath } from './showSlug';
import { formatVenueLocation } from './geography';

// Shared between NotificationBell (header dropdown) and NotificationsPage
// (full history) so both render the same text for the same row.
export const CONTENT_LABEL = {
    photo: 'photo',
    poster: 'poster',
    note: 'comment',
    setlist_submission: 'setlist submission',
    setlist: 'setlist',
    forum_thread: 'forum post',
    forum_reply: 'forum reply',
};

// notifications.created_at is a Postgres TIMESTAMP (no time zone) holding UTC,
// which the API returns with no "Z". JS parses an offset-less timestamp as
// *local* time, so west of UTC every notification landed hours in the future
// and read "just now" for its first 7-8 hours (then that many hours too new).
function parseUtcTimestamp(dateString) {
    return new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(dateString) ? dateString : `${dateString}Z`);
}

export function timeAgo(dateString) {
    const date = parseUtcTimestamp(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
}

// Shared with the staff-only report banner on the photo itself
// (PhotosSection.jsx) so both read the same reason/note split out of the
// notification's `message` column ("inappropriate" or "inappropriate: note").
export function parsePhotoReportMessage(message) {
    const [reason, note] = (message || 'inappropriate').split(/:\s(.+)/s);
    return { reason, note };
}

export function notificationText(n) {
    const actorName = n.actor?.display_name || n.actor?.username || 'Someone';
    const label = CONTENT_LABEL[n.content_type] || 'contribution';

    if (n.type === 'mention') return `${actorName} mentioned you in a comment`;
    if (n.type === 'submission') return `${actorName} submitted a setlist correction for review`;
    if (n.type === 'poster_interest') return `${actorName} sent you a message about your poster listing`;
    if (n.type === 'photo_report') {
        const { reason, note } = parsePhotoReportMessage(n.message);
        return `${actorName} reported a photo as ${reason}${note ? ` — "${note}"` : ''}`;
    }
    if (n.type === 'forum_report') {
        const { reason, note } = parsePhotoReportMessage(n.message);
        const what = n.content_type === 'forum_reply' ? 'reply' : 'thread';
        return `${actorName} reported a forum ${what} as ${reason}${note ? ` — "${note}"` : ''}`;
    }
    if (n.type === 'forum_reply') return `${actorName} replied to a thread you're in`;
    if (n.type === 'show_update') {
        return n.content_type === 'setlist'
            ? `${actorName} updated the setlist for a show you attended`
            : `${actorName} added a new ${label} to a show you attended`;
    }
    return `${actorName} thanked you for your ${label}`;
}

export function notificationShowLabel(n) {
    if (!n.shows) return null;
    const venue = formatVenueLocation(n.shows.venues);
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
    // Forum content is never show-scoped (n.shows is always null for it), and
    // every forum notification except a forum_report on a reply points its
    // content_id at the thread itself — a reply-report's content_id is the
    // reply id, which needs a lookup to resolve to its thread (see GET
    // /api/forum/reports), not available here, so it's left unlinked;
    // staff handle those through the Forum Moderation reports queue instead.
    if (n.content_type === 'forum_thread') {
        return `/forum/thread/${n.content_id}`;
    }
    if (n.content_type === 'forum_reply') return null;
    if (!n.shows) return null;
    const base = buildShowPath(n.shows);
    if (n.type === 'submission') return `${base}#submission-${n.content_id}`;
    return base;
}
