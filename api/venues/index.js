const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const { data: venues, error } = await supabase
                .from('venues').select('*').order('name');

            if (error) return res.status(500).json({ error: 'Failed to fetch venues' });

            res.json({ venues });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'POST') {
        try {
            const { name, city, state_country, address } = req.body;

            const { data: venue, error } = await supabase
                .from('venues')
                .insert([{ name, city, state_country, address }])
                .select()
                .single();

            if (error) return res.status(500).json({ error: 'Failed to create venue' });

            res.status(201).json(venue);
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
