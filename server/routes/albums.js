const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

/**
 * GET /api/albums
 * Get all albums
 */
router.get('/', async (req, res) => {
    try {
        const { data: albums, error } = await supabase
            .from('albums')
            .select('*')
            .order('release_date', { ascending: true });

        if (error) {
            console.error('Error fetching albums:', error);
            return res.status(500).json({ error: 'Failed to fetch albums' });
        }

        res.json({ albums });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/albums/:id
 * Get a single album with its songs
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get album details
        const { data: album, error: albumError } = await supabase
            .from('albums')
            .select('*')
            .eq('id', id)
            .single();

        if (albumError) {
            console.error('Error fetching album:', albumError);
            return res.status(500).json({ error: 'Failed to fetch album' });
        }

        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }

        // Get songs via album_songs junction table
        const { data: albumSongsData, error: songsError } = await supabase
            .from('album_songs')
            .select('track_order, songs(*)')
            .eq('album_id', id)
            .order('track_order', { ascending: true, nullsFirst: false });

        if (songsError) {
            console.error('Error fetching album songs:', songsError);
            return res.status(500).json({ error: 'Failed to fetch album songs' });
        }

        const songs = (albumSongsData || []).map(row => ({ ...row.songs, track_order: row.track_order }));

        res.json({
            album,
            songs
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/albums
 * Create a new album (admin only)
 */
router.post('/', async (req, res) => {
    try {
        // TODO: Add authentication middleware to verify admin status
        const { title, artist_name, release_date, album_art_url, album_type, notes } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Album title is required' });
        }

        const { data: album, error } = await supabase
            .from('albums')
            .insert([{
                title,
                artist_name: artist_name || 'Johnny Blue Skies',
                release_date,
                album_art_url,
                album_type: album_type || 'studio',
                notes
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating album:', error);
            return res.status(500).json({ error: 'Failed to create album' });
        }

        res.status(201).json({ album });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/albums/:id
 * Update an album (admin only)
 */
router.put('/:id', async (req, res) => {
    try {
        // TODO: Add authentication middleware to verify admin status
        const { id } = req.params;
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
            .from('albums')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating album:', error);
            return res.status(500).json({ error: 'Failed to update album' });
        }

        res.json({ album });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/albums/:id
 * Delete an album (admin only)
 * Note: This will set album_id to NULL for all songs associated with this album
 */
router.delete('/:id', async (req, res) => {
    try {
        // TODO: Add authentication middleware to verify admin status
        const { id } = req.params;

        const { error } = await supabase
            .from('albums')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting album:', error);
            return res.status(500).json({ error: 'Failed to delete album' });
        }

        res.json({ message: 'Album deleted successfully' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/albums/:id/songs
 * Get songs for an album in track order
 */
router.get('/:id/songs', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('album_songs')
            .select('track_order, songs(*)')
            .eq('album_id', id)
            .order('track_order', { ascending: true, nullsFirst: false });

        if (error) return res.status(500).json({ error: 'Failed to fetch album songs' });

        const songs = (data || []).map(row => ({ ...row.songs, track_order: row.track_order }));
        res.json({ songs });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/albums/:id/songs
 * Add a song to an album
 */
router.post('/:id/songs', async (req, res) => {
    try {
        const { id: album_id } = req.params;
        const { song_id, track_order } = req.body;

        const { data, error } = await supabase
            .from('album_songs')
            .insert([{ album_id, song_id, track_order }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'Song is already on this album' });
            return res.status(500).json({ error: 'Failed to add song to album' });
        }

        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/albums/:id/songs/order
 * Save track order — must be defined before /:id/songs/:songId to avoid route collision
 * Body: { songs: [{ song_id, track_order }] }
 */
router.put('/:id/songs/order', async (req, res) => {
    try {
        const { id: album_id } = req.params;
        const { songs } = req.body;

        if (!Array.isArray(songs)) return res.status(400).json({ error: 'songs must be an array' });

        const updates = await Promise.all(
            songs.map(({ song_id, track_order }) =>
                supabase.from('album_songs').update({ track_order }).eq('album_id', album_id).eq('song_id', song_id)
            )
        );

        if (updates.some(r => r.error)) return res.status(500).json({ error: 'Failed to update song order' });

        res.json({ message: 'Order updated' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/albums/:id/songs/:songId
 * Remove a song from an album
 */
router.delete('/:id/songs/:songId', async (req, res) => {
    try {
        const { id: album_id, songId: song_id } = req.params;

        const { error } = await supabase
            .from('album_songs')
            .delete()
            .eq('album_id', album_id)
            .eq('song_id', song_id);

        if (error) return res.status(500).json({ error: 'Failed to remove song from album' });

        res.json({ message: 'Song removed from album' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

