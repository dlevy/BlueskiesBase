const { supabaseAdmin } = require('../../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { showId } = req.query;

    try {
        const { data: photos, error } = await supabaseAdmin
            .from('user_photos')
            .select(`*, profiles:user_id (id, username)`)
            .eq('show_id', showId)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) return res.status(500).json({ error: 'Failed to fetch photos' });

        res.json({ photos });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
