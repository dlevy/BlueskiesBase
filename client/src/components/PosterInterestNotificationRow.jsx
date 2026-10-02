import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPosterInterest } from '../services/api';
import { timeAgo } from '../utils/notifications';

const textareaClass = "w-full rounded-lg border border-white/10 bg-white/5 py-1.5 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500 resize-none";

function CloseIcon() {
    return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

function RestoreIcon() {
    return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4 9a8 8 0 1 1 2.34 5.66" />
        </svg>
    );
}

/**
 * A 'poster_interest' notification needs its own row shape (message text +
 * a Reply box) instead of the generic Link-wrapped template every other
 * notification type uses — a Reply textarea/button can't nest inside an
 * anchor, so this is deliberately NOT wrapped in a <Link>.
 *
 * `onToggleDismissed(notification)` is called for both dismiss and restore —
 * the caller decides which based on `notification.dismissed_at`, same as
 * NotificationsPage's existing handleToggleDismissed.
 */
export default function PosterInterestNotificationRow({ notification, onToggleDismissed, compact = false }) {
    const [replying, setReplying] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(null);

    const actorName = notification.actor?.display_name || notification.actor?.username || 'Someone';
    const actorUsername = notification.actor?.username;
    const isDismissed = !!notification.dismissed_at;

    const handleSendReply = async () => {
        if (!replyText.trim() || sending) return;
        setSending(true);
        setError(null);
        try {
            await sendPosterInterest(notification.content_id, replyText.trim(), notification.actor?.id);
            setSent(true);
            setReplying(false);
            setReplyText('');
        } catch (err) {
            setError(err.message || 'Failed to send reply');
        } finally {
            setSending(false);
        }
    };

    return (
        <div
            className={`${compact ? 'px-4 py-3' : 'rounded-xl border border-white/10 bg-white/[0.03] p-4'} flex items-start gap-2`}
            style={isDismissed ? { opacity: 0.55 } : undefined}
        >
            {!notification.read_at && !isDismissed && (
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm" style={{ color: 'var(--p-color-primary)' }}>
                    {actorName} sent you a message about your poster listing
                </p>
                {notification.message && (
                    <p className="text-xs rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        “{notification.message}”
                    </p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                    {actorUsername && (
                        <Link to={`/profile/${actorUsername}`} className="text-xs font-medium hover:underline" style={{ color: 'var(--p-color-primary)' }}>
                            View profile
                        </Link>
                    )}
                    {!replying && !sent && (
                        <button type="button" onClick={() => setReplying(true)} className="text-xs font-medium hover:underline" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Reply
                        </button>
                    )}
                    {sent && (
                        <span className="text-xs" style={{ color: '#4ade80' }}>Reply sent</span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {timeAgo(notification.created_at)}{isDismissed ? ' · Dismissed' : ''}
                    </span>
                </div>

                {replying && (
                    <div className="space-y-1.5 pt-1">
                        <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply…"
                            rows={2}
                            className={textareaClass}
                            autoFocus
                        />
                        {error && <p className="text-xs" style={{ color: 'var(--p-color-error)' }}>{error}</p>}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSendReply}
                                disabled={sending || !replyText.trim()}
                                className="text-xs px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all disabled:opacity-50"
                            >
                                {sending ? 'Sending…' : 'Send'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setReplying(false); setReplyText(''); setError(null); }}
                                disabled={sending}
                                className="text-xs px-2.5 py-1 rounded-lg border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50"
                                style={{ color: 'var(--p-color-contrast-medium)' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {onToggleDismissed && (
                <button
                    type="button"
                    onClick={() => onToggleDismissed(notification)}
                    aria-label={isDismissed ? 'Restore notification' : 'Dismiss notification'}
                    title={isDismissed ? 'Restore' : 'Dismiss'}
                    className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-all"
                    style={{ color: 'var(--p-color-contrast-low)' }}
                >
                    {isDismissed ? <RestoreIcon /> : <CloseIcon />}
                </button>
            )}
        </div>
    );
}
