const { supabaseAdmin } = require('../../_lib/supabase');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { showId } = req.query;

    const user = await authenticate(req, res);
    if (!user) return;

    try {
        const { data: note, error } = await supabaseAdmin
            .from('user_notes')
            .select('*')
            .eq('show_id', showId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) return res.status(500).json({ error: 'Failed to fetch note' });

        res.json({ note });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
