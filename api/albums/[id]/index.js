const { supabase } = require('../../_lib/supabase');

module.exports = async function handler(req, res) {
    const { id } = req.query;

    if (req.method === 'GET') {
        try {
            const { data: album, error: albumError } = await supabase
                .from('albums').select('*').eq('id', id).single();

            if (albumError || !album) return res.status(404).json({ error: 'Album not found' });

            const { data: songs, error: songsError } = await supabase
                .from('songs').select('*').eq('album_id', id).order('title');

            if (songsError) return res.status(500).json({ error: 'Failed to fetch album songs' });

            res.json({ album, songs: songs || [] });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'PUT') {
        try {
            const { title, artist_name, release_date, album_art_url, album_type, notes } = req.body;

            const updates = {};
            if (title !== undefined) updates.title = title;
            if (artist_name !== undefined) updates.artist_name = artist_name;
            if (release_date !== undefined) updates.release_date = release_date;
            if (album_art_url !== undefined) updates.album_art_url = album_art_url;
            if (album_type !== undefined) updates.album_type = album_type;
            if (notes !== undefined) updates.notes = notes;
            updates.updated_at = new Date().toISOString();

            const { data: album, error } = await supabase
                .from('albums').update(updates).eq('id', id).select().single();

            if (error) return res.status(500).json({ error: 'Failed to update album' });

            res.json({ album });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'DELETE') {
        try {
            const { error } = await supabase.from('albums').delete().eq('id', id);

            if (error) return res.status(500).json({ error: 'Failed to delete album' });

            res.json({ message: 'Album deleted successfully' });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
