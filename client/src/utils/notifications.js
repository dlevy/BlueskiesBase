// Shared between NotificationBell (header dropdown) and NotificationsPage
// (full history) so both render the same text for the same row.
export const CONTENT_LABEL = {
    photo: 'photo',
    poster: 'poster',
    note: 'comment',
    setlist_submission: 'setlist submission',
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
    return `${actorName} thanked you for your ${label}`;
}

export function notificationShowLabel(n) {
    if (!n.shows) return null;
    return `${n.shows.artist_name} — ${n.shows.venues?.city || ''}${n.shows.venues?.state_country ? `, ${n.shows.venues.state_country}` : ''}`;
}
