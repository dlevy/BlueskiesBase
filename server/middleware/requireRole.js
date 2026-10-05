const { supabase } = require('../config/supabase');

// Shared bearer-token -> profiles.role lookup used by both middlewares below,
// so a request only ever hits Supabase auth + the profiles table once.
async function loadRequester(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return { status: 401, error: 'No authorization header' };

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { status: 401, error: 'Unauthorized' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', user.id)
        .single();

    return { user, role: profile?.role || 'member' };
}

/**
 * Full admin only — can create/edit/delete anything, including other users'
 * accounts. Same semantics as admin.js's original requireAdmin.
 */
async function requireAdmin(req, res, next) {
    const result = await loadRequester(req);
    if (result.error) return res.status(result.status).json({ error: result.error });
    if (result.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    req.user = result.user;
    req.role = result.role;
    next();
}

/**
 * Editor or admin — can create/edit catalog data (shows, songs, venues,
 * albums, bands, setlists) and use the Instagram post tool, but this alone
 * never grants delete access to a whole show/song/album, or any user
 * management — those routes stay on requireAdmin.
 */
async function requireEditorOrAdmin(req, res, next) {
    const result = await loadRequester(req);
    if (result.error) return res.status(result.status).json({ error: result.error });
    if (result.role !== 'admin' && result.role !== 'editor') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = result.user;
    req.role = result.role;
    next();
}

/**
 * Resolves `{ user, role }` from a bearer token if one is present and valid,
 * otherwise returns `{ user: null, role: null }` rather than rejecting —
 * for routes that accept both guest and logged-in callers but still want to
 * know who's calling when they can (analytics events: an invalid/expired
 * token shouldn't block logging the event, it should just log it as a guest).
 */
async function loadRequesterOptional(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return { user: null, role: null };

    const result = await loadRequester(req);
    if (result.error) return { user: null, role: null };
    return { user: result.user, role: result.role };
}

module.exports = { requireAdmin, requireEditorOrAdmin, loadRequesterOptional };
