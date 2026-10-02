const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Middleware to verify authentication
 */
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
};

/**
 * GET /api/notifications
 * The logged-in user's own notifications, most recent first. The embedded
 * `shows` shape (id, show_date, artist_name, venues.city/state_country)
 * matches exactly what client/src/utils/showSlug.js's buildShowPath() needs,
 * so the client can link back to the show with no extra fetch. `unreadCount`
 * is a separate exact count (not just derived from this capped page) so the
 * header badge stays accurate regardless of the page size.
 *
 * By default, dismissed notifications (closed out of the header dropdown,
 * but not deleted — dismissal keeps history, it just hides the item) are
 * excluded. Pass ?includeDismissed=true for the full-history page. Both
 * `unreadCount` and the dropdown's default list exclude dismissed items —
 * closing a notification also takes it out of the unread badge.
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const includeDismissed = req.query.includeDismissed === 'true';
        const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

        let query = supabaseAdmin
            .from('notifications')
            .select(`
                id,
                type,
                content_type,
                content_id,
                message,
                read_at,
                dismissed_at,
                created_at,
                actor:actor_id ( id, username, display_name, avatar_url ),
                shows ( id, show_date, artist_name, venues ( city, state_country ) )
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (!includeDismissed) {
            query = query.is('dismissed_at', null);
        }

        const { data: notifications, error } = await query;

        if (error) {
            console.error('Error fetching notifications:', error);
            return res.status(500).json({ error: 'Failed to fetch notifications' });
        }

        const { count: unreadCount, error: countError } = await supabaseAdmin
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', req.user.id)
            .is('read_at', null)
            .is('dismissed_at', null);

        if (countError) {
            console.error('Error counting unread notifications:', countError);
            return res.status(500).json({ error: 'Failed to fetch unread count' });
        }

        res.json({ notifications: notifications || [], unreadCount: unreadCount || 0 });
    } catch (error) {
        console.error('Error in GET /api/notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/notifications/read-all
 * Mark all of the logged-in user's unread notifications as read. Called when
 * the header's notification dropdown is opened.
 */
router.put('/read-all', authenticate, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', req.user.id)
            .is('read_at', null);

        if (error) {
            console.error('Error marking notifications read:', error);
            return res.status(500).json({ error: 'Failed to mark notifications read' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in PUT /api/notifications/read-all:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/notifications/:notificationId/dismiss
 * Close a notification out of the header dropdown. The row is kept (history
 * page still shows it) — only dismissed_at is set. Also marks it read, since
 * a dismissed notification shouldn't keep counting toward the unread badge.
 */
router.put('/:notificationId/dismiss', authenticate, async (req, res) => {
    try {
        const { notificationId } = req.params;

        const { data: notification, error: fetchError } = await supabaseAdmin
            .from('notifications')
            .select('user_id, read_at')
            .eq('id', notificationId)
            .maybeSingle();

        if (fetchError || !notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        if (notification.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to dismiss this notification' });
        }

        const now = new Date().toISOString();
        const { error } = await supabaseAdmin
            .from('notifications')
            .update({ dismissed_at: now, read_at: notification.read_at || now })
            .eq('id', notificationId);

        if (error) {
            console.error('Error dismissing notification:', error);
            return res.status(500).json({ error: 'Failed to dismiss notification' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in PUT /api/notifications/:notificationId/dismiss:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/notifications/:notificationId/restore
 * Undo a dismiss from the full-history page.
 */
router.put('/:notificationId/restore', authenticate, async (req, res) => {
    try {
        const { notificationId } = req.params;

        const { data: notification, error: fetchError } = await supabaseAdmin
            .from('notifications')
            .select('user_id')
            .eq('id', notificationId)
            .maybeSingle();

        if (fetchError || !notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        if (notification.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to restore this notification' });
        }

        const { error } = await supabaseAdmin
            .from('notifications')
            .update({ dismissed_at: null })
            .eq('id', notificationId);

        if (error) {
            console.error('Error restoring notification:', error);
            return res.status(500).json({ error: 'Failed to restore notification' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in PUT /api/notifications/:notificationId/restore:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
