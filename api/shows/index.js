const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const { data: shows, error, count } = await supabase
                .from('shows')
                .select(`*, venues (id, name, city, state_country, address)`, { count: 'exact' })
                .order('show_date', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) return res.status(500).json({ error: 'Failed to fetch shows' });

            res.json({
                shows,
                pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
            });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'POST') {
        try {
            const { venue_id, show_date, artist_name, tour_name, notes, has_images, source_types } = req.body;

            const { data: show, error } = await supabase
                .from('shows')
                .insert([{ venue_id, show_date, artist_name, tour_name, notes, has_images, source_types }])
                .select()
                .single();

            if (error) return res.status(500).json({ error: 'Failed to create show' });

            res.status(201).json(show);
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
