const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { title, original } = req.query;

        let query = supabase.from('songs').select('*').order('title');

        if (title) query = query.ilike('title', `%${title}%`);
        if (original === 'true') query = query.eq('is_original', true);
        else if (original === 'false') query = query.eq('is_original', false);

        const { data: songs, error } = await query;
        if (error) return res.status(500).json({ error: 'Failed to search songs' });

        res.json({ count: songs.length, songs });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
