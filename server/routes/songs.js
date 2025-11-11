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

module.exports = router;

