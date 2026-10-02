import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PSpinner, PInlineNotification } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import { getNotifications, dismissNotification, restoreNotification } from '../services/api';
import { timeAgo, notificationText, notificationShowLabel, notificationLink } from '../utils/notifications';
import SEO from '../components/SEO';
import PosterInterestNotificationRow from '../components/PosterInterestNotificationRow';

const HISTORY_LIMIT = 100;

export default function NotificationsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!user) navigate('/member-login');
    }, [user, navigate]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getNotifications({ includeDismissed: true, limit: HISTORY_LIMIT });
            setNotifications(data.notifications || []);
        } catch (err) {
            console.error('[NotificationsPage] Error loading notifications:', err);
            setError('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (user) load(); }, [user, load]);

    const handleToggleDismissed = async (n) => {
        const wasDismissed = !!n.dismissed_at;
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, dismissed_at: wasDismissed ? null : new Date().toISOString() } : x));
        try {
            if (wasDismissed) await restoreNotification(n.id);
            else await dismissNotification(n.id);
        } catch (err) {
            console.error('[NotificationsPage] Error toggling dismissed state:', err);
            await load();
        }
    };

    if (!user) return null;

    return (
        <div className="px-4 py-4 md:py-6 max-w-3xl mx-auto">
            <SEO title="Notifications" description="Your notification history." />

            <PHeading size="xl" tag="h1" className="mb-4">Notifications</PHeading>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} className="mb-4" />
            )}

            {loading ? (
                <div className="flex items-center gap-3 py-8">
                    <PSpinner size="small" aria={{ 'aria-label': 'Loading notifications' }} />
                    <PText color="contrast-medium">Loading notifications…</PText>
                </div>
            ) : notifications.length === 0 ? (
                <PText color="contrast-medium" align="center" className="py-8">No notifications yet.</PText>
            ) : (
                <div className="space-y-2">
                    {notifications.map(n => {
                        if (n.type === 'poster_interest') {
                            return (
                                <PosterInterestNotificationRow
                                    key={n.id}
                                    notification={n}
                                    onToggleDismissed={handleToggleDismissed}
                                />
                            );
                        }
                        const showLabel = notificationShowLabel(n);
                        const isDismissed = !!n.dismissed_at;
                        const link = notificationLink(n);
                        return (
                            <div
                                key={n.id}
                                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-start gap-3"
                                style={isDismissed ? { opacity: 0.55 } : undefined}
                            >
                                {!n.read_at && !isDismissed && (
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
                                )}
                                <div className="min-w-0 flex-1">
                                    <PText size="sm">{notificationText(n)}</PText>
                                    {showLabel && (
                                        link
                                            ? <Link to={link} className="hover:underline">
                                                <PText size="xs" style={{ color: 'var(--p-color-contrast-medium)' }}>{showLabel}</PText>
                                            </Link>
                                            : <PText size="xs" style={{ color: 'var(--p-color-contrast-medium)' }}>{showLabel}</PText>
                                    )}
                                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                        {timeAgo(n.created_at)}{isDismissed ? ' · Dismissed' : ''}
                                    </PText>
                                </div>
                                <PButtonPure size="x-small" icon={isDismissed ? 'refresh' : 'close'} onClick={() => handleToggleDismissed(n)}>
                                    {isDismissed ? 'Restore' : 'Dismiss'}
                                </PButtonPure>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
