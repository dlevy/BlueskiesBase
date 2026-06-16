const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// Middleware: verify the requester is an authenticated admin
async function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    if (!profile?.is_admin) return res.status(403).json({ error: 'Forbidden' });

    req.adminUser = user;
    next();
}

/**
 * GET /api/admin/users
 * List all auth users with signup date and confirmation status
 */
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.per_page) || 200;

        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) {
            console.error('[admin/users] listUsers error:', error);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }

        const users = (data.users || []).map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            email_confirmed_at: u.email_confirmed_at,
            last_sign_in_at: u.last_sign_in_at,
            confirmed: !!u.email_confirmed_at,
        }));

        res.json({ users, total: data.total ?? users.length });
    } catch (err) {
        console.error('[admin/users] error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/users/:userId/resend-confirmation
 * Resend the confirmation/activation email for a user
 */
router.post('/users/:userId/resend-confirmation', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // Get the user's email first
        const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);
        if (getUserError || !userData?.user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const email = userData.user.email;

        // Resend the confirmation email via Supabase's resend API
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
                emailRedirectTo: `${process.env.FRONTEND_URL || 'https://www.skysets.org'}/member-login`,
            },
        });

        if (error) {
            console.error('[admin/resend-confirmation] resend error:', error);
            return res.status(500).json({ error: 'Failed to resend confirmation email' });
        }

        res.json({ success: true, email });
    } catch (err) {
        console.error('[admin/resend-confirmation] error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
