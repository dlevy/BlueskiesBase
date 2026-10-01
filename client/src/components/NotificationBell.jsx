import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getNotifications, markAllNotificationsRead, dismissNotification } from '../services/api';
import { timeAgo, notificationText, notificationShowLabel, notificationLink } from '../utils/notifications';

const POLL_INTERVAL_MS = 60000;

function BellIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

export default function NotificationBell() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const data = await getNotifications();
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
        } catch (err) {
            console.error('[NotificationBell] Error loading notifications:', err);
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        load();
        const interval = setInterval(load, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [user, load]);

    // Close the dropdown on an outside click.
    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const handleToggleOpen = async () => {
        const willOpen = !open;
        setOpen(willOpen);
        if (willOpen && unreadCount > 0) {
            setUnreadCount(0);
            try {
                await markAllNotificationsRead();
            } catch (err) {
                console.error('[NotificationBell] Error marking notifications read:', err);
                setError('Failed to mark notifications as read');
            }
        }
    };

    const handleDismiss = async (e, notificationId) => {
        e.preventDefault();
        e.stopPropagation();
        const wasUnread = notifications.find(n => n.id === notificationId && !n.read_at);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
        try {
            await dismissNotification(notificationId);
        } catch (err) {
            console.error('[NotificationBell] Error dismissing notification:', err);
            await load();
        }
    };

    if (!user) return null;

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={handleToggleOpen}
                aria-label="Notifications"
                className="relative h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
                style={{ color: 'var(--p-color-contrast-medium)' }}
            >
                <BellIcon />
                {unreadCount > 0 && (
                    <span
                        className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: '#f59e0b', color: '#1a1e26' }}
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-white/10 shadow-xl z-50 overflow-hidden"
                    style={{ background: '#1a1e26' }}
                >
                    <div className="px-4 py-3 border-b border-white/10">
                        <span className="text-sm font-semibold" style={{ color: 'var(--p-color-primary)' }}>Notifications</span>
                    </div>

                    {error && (
                        <p className="px-4 py-2 text-xs" style={{ color: 'var(--p-color-error)' }}>{error}</p>
                    )}

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--p-color-contrast-low)' }}>
                                No notifications yet.
                            </p>
                        ) : (
                            notifications.map(n => {
                                const showLabel = notificationShowLabel(n);
                                const content = (
                                    <div className="px-4 py-3 hover:bg-white/5 transition-colors flex gap-2 items-start group">
                                        {!n.read_at && (
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm" style={{ color: 'var(--p-color-primary)' }}>{notificationText(n)}</p>
                                            {showLabel && (
                                                <p className="text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>{showLabel}</p>
                                            )}
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>{timeAgo(n.created_at)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => handleDismiss(e, n.id)}
                                            aria-label="Dismiss notification"
                                            title="Dismiss"
                                            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                                            style={{ color: 'var(--p-color-contrast-low)' }}
                                        >
                                            <CloseIcon />
                                        </button>
                                    </div>
                                );
                                return n.shows ? (
                                    <Link key={n.id} to={notificationLink(n)} onClick={() => setOpen(false)} className="block">
                                        {content}
                                    </Link>
                                ) : (
                                    <div key={n.id}>{content}</div>
                                );
                            })
                        )}
                    </div>

                    <Link
                        to="/notifications"
                        onClick={() => setOpen(false)}
                        className="block px-4 py-2.5 text-xs text-center font-medium border-t border-white/10 hover:bg-white/5 transition-colors"
                        style={{ color: 'var(--p-color-primary)' }}
                    >
                        Show all notifications
                    </Link>
                </div>
            )}
        </div>
    );
}
