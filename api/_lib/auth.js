const { supabase, supabaseAdmin } = require('./supabase');

const authenticate = async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return null;
    }
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        res.status(401).json({ error: 'Invalid token' });
        return null;
    }
    return user;
};

const requireAdmin = async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return null;

    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    if (error || !profile?.is_admin) {
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }

    return user;
};

module.exports = { authenticate, requireAdmin };
