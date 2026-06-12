const { supabase } = require('../../_lib/supabase');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { showId } = req.query;

    const user = await authenticate(req, res);
    if (!user) return;

    try {
        const { data, error } = await supabase
            .from('user_shows')
            .select('id')
            .eq('user_id', user.id)
            .eq('show_id', showId)
            .maybeSingle();

        if (error) return res.status(500).json({ error: 'Failed to check attendance' });

        res.json({ attended: !!data });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
