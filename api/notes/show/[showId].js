const { supabaseAdmin } = require('../../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { showId } = req.query;

    try {
        const { data: notes, error } = await supabaseAdmin
            .from('user_notes')
            .select(`*, profiles:user_id (id, username)`)
            .eq('show_id', showId)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: 'Failed to fetch notes' });

        res.json({ notes });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
