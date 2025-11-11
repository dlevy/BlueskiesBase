const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

/**
 * GET /api/songs
 * Get all songs
 */
router.get('/', async (req, res) => {
    try {
        const { data: songs, error } = await supabase
            .from('songs')
            .select('*')
            .order('title');

        if (error) {
            console.error('Error fetching songs:', error);
            return res.status(500).json({ error: 'Failed to fetch songs' });
        }

        res.json({ songs });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/songs/:id
 * Get a single song with all performances
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: song, error: songError } = await supabase
            .from('songs')
            .select('*')
            .eq('id', id)
            .single();

        if (songError) {
            console.error('Error fetching song:', songError);
            return res.status(404).json({ error: 'Song not found' });
        }

        // Get all performances of this song
        const { data: performances, error: perfError } = await supabase
            .from('setlist_songs')
            .select(`
                *,
                shows (
                    id,
                    show_date,
                    artist_name,
                    venues (
                        name,
                        city,
                        state_country
                    )
                )
            `)
            .eq('song_id', id)
            .order('shows(show_date)', { ascending: false });

        if (perfError) {
            console.error('Error fetching performances:', perfError);
            return res.status(500).json({ error: 'Failed to fetch performances' });
        }

        res.json({
            ...song,
            performances
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/songs
 * Create a new song (admin only)
 */
router.post('/', async (req, res) => {
    try {
        const { title, original_artist, is_original, written_by, lyrics, notes } = req.body;

        // TODO: Add authentication middleware to verify admin status

        const { data: song, error } = await supabase
            .from('songs')
            .insert([{ title, original_artist, is_original, written_by, lyrics, notes }])
            .select()
            .single();

        if (error) {
            console.error('Error creating song:', error);
            return res.status(500).json({ error: 'Failed to create song' });
        }

        res.status(201).json(song);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/songs/:id
 * Update a song (admin only)
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, original_artist, is_original, written_by, lyrics, notes } = req.body;

        // TODO: Add authentication middleware to verify admin status

        const { data: song, error } = await supabase
            .from('songs')
            .update({ title, original_artist, is_original, written_by, lyrics, notes, updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating song:', error);
            return res.status(500).json({ error: 'Failed to update song' });
        }

        res.json(song);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/songs/:id
 * Delete a song (admin only)
 * Note: This will fail if the song is used in any setlists due to foreign key constraint
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // TODO: Add authentication middleware to verify admin status

        // Check if song is used in any setlists
        const { data: usages, error: usageError } = await supabase
            .from('setlist_songs')
            .select('id')
            .eq('song_id', id)
            .limit(1);

        if (usageError) {
            console.error('Error checking song usage:', usageError);
            return res.status(500).json({ error: 'Failed to check song usage' });
        }

        if (usages && usages.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete song that is used in setlists',
                message: 'This song appears in one or more setlists and cannot be deleted.'
            });
        }

        const { error } = await supabase
            .from('songs')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting song:', error);
            return res.status(500).json({ error: 'Failed to delete song' });
        }

        res.json({ message: 'Song deleted successfully' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

