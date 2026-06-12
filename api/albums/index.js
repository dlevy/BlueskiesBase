const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const { data: albums, error } = await supabase
                .from('albums').select('*').order('release_date', { ascending: true });

            if (error) return res.status(500).json({ error: 'Failed to fetch albums' });

            res.json({ albums });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'POST') {
        try {
            const { title, artist_name, release_date, album_art_url, album_type, notes } = req.body;

            if (!title) return res.status(400).json({ error: 'Album title is required' });

            const { data: album, error } = await supabase
                .from('albums')
                .insert([{
                    title,
                    artist_name: artist_name || 'Johnny Blue Skies',
                    release_date, album_art_url,
                    album_type: album_type || 'studio',
                    notes
                }])
                .select()
                .single();

            if (error) return res.status(500).json({ error: 'Failed to create album' });

            res.status(201).json({ album });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
