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

        // Get all songs from this album
        const { data: songs, error: songsError } = await supabase
            .from('songs')
            .select('*')
            .eq('album_id', id)
            .order('title');

        if (songsError) {
            console.error('Error fetching album songs:', songsError);
            return res.status(500).json({ error: 'Failed to fetch album songs' });
        }

        res.json({
            album,
            songs: songs || []
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

module.exports = router;

