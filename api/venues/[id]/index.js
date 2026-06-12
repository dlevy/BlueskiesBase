const { supabase } = require('../../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { id } = req.query;

    try {
        const { data: venue, error: venueError } = await supabase
            .from('venues').select('*').eq('id', id).single();

        if (venueError) return res.status(404).json({ error: 'Venue not found' });

        const { data: shows, error: showsError } = await supabase
            .from('shows').select('*').eq('venue_id', id).order('show_date', { ascending: false });

        if (showsError) return res.status(500).json({ error: 'Failed to fetch shows' });

        res.json({ ...venue, shows });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
