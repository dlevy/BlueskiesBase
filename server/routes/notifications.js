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
 * header badge stays accurate even with more than 30 notifications.
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { data: notifications, error } = await supabaseAdmin
            .from('notifications')
            .select(`
                id,
                type,
                content_type,
                content_id,
                read_at,
                created_at,
                actor:actor_id ( id, username, display_name, avatar_url ),
                shows ( id, show_date, artist_name, venues ( city, state_country ) )
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) {
            console.error('Error fetching notifications:', error);
            return res.status(500).json({ error: 'Failed to fetch notifications' });
        }

        const { count: unreadCount, error: countError } = await supabaseAdmin
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', req.user.id)
            .is('read_at', null);

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

module.exports = router;
