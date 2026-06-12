const { supabaseAdmin } = require('../../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { showId } = req.query;

    try {
        const { data: poster, error } = await supabaseAdmin
            .from('user_posters')
            .select(`*, profiles:user_id (id, username)`)
            .eq('show_id', showId)
            .single();

        if (error && error.code !== 'PGRST116') return res.status(500).json({ error: 'Failed to fetch poster' });

        res.json({ poster: poster || null });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
