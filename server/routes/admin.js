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

/**
 * POST /api/admin/users/:userId/send-password-reset
 * Sends a password-reset email so a user who's stuck — e.g. their original
 * signup confirmation email never arrived — can set a password and get into
 * their account directly. Verifying the recovery link also confirms their
 * email as a side effect, so this doubles as an unblock for that case.
 */
router.post('/users/:userId/send-password-reset', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);
        if (getUserError || !userData?.user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const email = userData.user.email;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.FRONTEND_URL || 'https://www.skysets.org'}/reset-password`,
        });

        if (error) {
            console.error('[admin/send-password-reset] error:', error);
            return res.status(500).json({ error: 'Failed to send password reset email' });
        }

        res.json({ success: true, email });
    } catch (err) {
        console.error('[admin/send-password-reset] error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/admin/users/:userId
 * Permanently deletes a user: their auth account, profile, and everything
 * they've contributed (photos/posters — including the underlying storage
 * files — notes, setlist submissions, attendance, and song reactions).
 */
router.delete('/users/:userId', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);
        if (getUserError || !userData?.user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove uploaded photo/poster files from storage before deleting the rows
        // that point to them.
        const { data: photos } = await supabase.from('user_photos').select('photo_url').eq('user_id', userId);
        const photoPaths = (photos || []).map(p => p.photo_url?.split('/show-photos/')[1]).filter(Boolean);
        if (photoPaths.length) await supabase.storage.from('show-photos').remove(photoPaths);

        const { data: posters } = await supabase.from('user_posters').select('poster_url').eq('user_id', userId);
        const posterPaths = (posters || []).map(p => p.poster_url?.split('/show-posters/')[1]).filter(Boolean);
        if (posterPaths.length) await supabase.storage.from('show-posters').remove(posterPaths);

        const { data: submissions } = await supabase.from('setlist_submissions').select('id').eq('user_id', userId);
        const submissionIds = (submissions || []).map(s => s.id);
        if (submissionIds.length) {
            await supabase.from('setlist_submission_songs').delete().in('submission_id', submissionIds);
        }

        await Promise.all([
            supabase.from('user_photos').delete().eq('user_id', userId),
            supabase.from('user_posters').delete().eq('user_id', userId),
            supabase.from('user_notes').delete().eq('user_id', userId),
            supabase.from('setlist_submissions').delete().eq('user_id', userId),
            supabase.from('user_shows').delete().eq('user_id', userId),
            supabase.from('setlist_song_reactions').delete().eq('user_id', userId),
        ]);

        await supabase.from('profiles').delete().eq('id', userId);

        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteError) {
            console.error('[admin/delete-user] deleteUser error:', deleteError);
            return res.status(500).json({ error: 'Failed to delete user account' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[admin/delete-user] error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/tour-style/:tourName
 * The Instagram post style assigned to a tour, so posts stay visually
 * consistent within a tour. Returns { style_key: null } if unset.
 */
router.get('/tour-style/:tourName', requireAdmin, async (req, res) => {
    try {
        const { tourName } = req.params;

        const { data, error } = await supabase
            .from('tour_post_styles')
            .select('style_key')
            .eq('tour_name', tourName)
            .maybeSingle();

        if (error) {
            console.error('[admin/tour-style] fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch tour style' });
        }

        res.json({ style_key: data?.style_key || null });
    } catch (err) {
        console.error('[admin/tour-style] error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/tour-style/:tourName
 * Assign (or change) the Instagram post style for a tour.
 * Body: { style_key: string }
 */
router.put('/tour-style/:tourName', requireAdmin, async (req, res) => {
    try {
        const { tourName } = req.params;
        const { style_key } = req.body;

        if (!style_key) {
            return res.status(400).json({ error: 'style_key is required' });
        }

        const { error } = await supabase
            .from('tour_post_styles')
            .upsert({ tour_name: tourName, style_key, updated_at: new Date().toISOString() }, { onConflict: 'tour_name' });

        if (error) {
            console.error('[admin/tour-style] upsert error:', error);
            return res.status(500).json({ error: 'Failed to save tour style' });
        }

        res.json({ success: true, tour_name: tourName, style_key });
    } catch (err) {
        console.error('[admin/tour-style] error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
