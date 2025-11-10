const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

/**
 * GET /api/venues
 * Get all venues
 */
router.get('/', async (req, res) => {
    try {
        const { data: venues, error } = await supabase
            .from('venues')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching venues:', error);
            return res.status(500).json({ error: 'Failed to fetch venues' });
        }

        res.json({ venues });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/venues/:id
 * Get a single venue with all shows
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: venue, error: venueError } = await supabase
            .from('venues')
            .select('*')
            .eq('id', id)
            .single();

        if (venueError) {
            console.error('Error fetching venue:', venueError);
            return res.status(404).json({ error: 'Venue not found' });
        }

        // Get all shows at this venue
        const { data: shows, error: showsError } = await supabase
            .from('shows')
            .select('*')
            .eq('venue_id', id)
            .order('show_date', { ascending: false });

        if (showsError) {
            console.error('Error fetching shows:', showsError);
            return res.status(500).json({ error: 'Failed to fetch shows' });
        }

        res.json({
            ...venue,
            shows
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/venues
 * Create a new venue (admin only)
 */
router.post('/', async (req, res) => {
    try {
        const { name, city, state_country, address } = req.body;

        // TODO: Add authentication middleware to verify admin status

        const { data: venue, error } = await supabase
            .from('venues')
            .insert([{ name, city, state_country, address }])
            .select()
            .single();

        if (error) {
            console.error('Error creating venue:', error);
            return res.status(500).json({ error: 'Failed to create venue' });
        }

        res.status(201).json(venue);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

