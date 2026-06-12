const { supabase } = require('../../_lib/supabase');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const user = await authenticate(req, res);
    if (!user) return;

    try {
        const { data: userShows, error } = await supabase
            .from('user_shows')
            .select(`
                id, show_id, marked_at,
                shows (id, show_date, artist_name, tour_name,
                    venues (name, city, state_country)
                )
            `)
            .eq('user_id', user.id)
            .order('shows(show_date)', { ascending: false });

        if (error) return res.status(500).json({ error: 'Failed to fetch attended shows' });

        res.json({ shows: userShows || [] });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
