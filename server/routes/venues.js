const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAdmin, requireEditorOrAdmin } = require('../middleware/requireRole');

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
            .order('show_date', { ascending: false })
            .order('day_order', { ascending: true });

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
 * Create a new venue (editor or admin)
 */
router.post('/', requireEditorOrAdmin, async (req, res) => {
    try {
        const { name, city, state_country, address } = req.body;

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

/**
 * PUT /api/venues/:id
 * Update a venue (editor or admin)
 */
router.put('/:id', requireEditorOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, city, state_country, address } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (city !== undefined) updates.city = city;
        if (state_country !== undefined) updates.state_country = state_country;
        if (address !== undefined) updates.address = address;

        const { data: venue, error } = await supabase
            .from('venues')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating venue:', error);
            return res.status(500).json({ error: 'Failed to update venue' });
        }

        res.json(venue);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/venues/:id/geocode
 * Cache a geocoded lat/lng for a venue that doesn't have one yet — called by
 * ShowMapShare.jsx after it falls back to Nominatim for a venue missing
 * coordinates, so the next viewer (any show's map, any user) doesn't have to
 * re-geocode it. Deliberately public (no auth) since every map view is a
 * potential contributor to this shared cache, and it's narrowly safe: it
 * only ever fills a currently-null pair, never overwrites existing
 * (admin-entered or already-cached) coordinates.
 */
router.patch('/:id/geocode', async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude } = req.body;

        if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
            !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({ error: 'latitude/longitude must be valid coordinates' });
        }

        const { data: venue, error: fetchError } = await supabase
            .from('venues')
            .select('latitude, longitude')
            .eq('id', id)
            .single();
        if (fetchError || !venue) {
            return res.status(404).json({ error: 'Venue not found' });
        }
        if (venue.latitude != null || venue.longitude != null) {
            return res.json({ cached: false, reason: 'already set' });
        }

        const { error: updateError } = await supabase
            .from('venues')
            .update({ latitude, longitude })
            .eq('id', id);
        if (updateError) {
            console.error('Error caching venue geocode:', updateError);
            return res.status(500).json({ error: 'Failed to cache coordinates' });
        }

        res.json({ cached: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/venues/:id
 * Delete a venue (admin only). Refuses if any show still references it —
 * unlike albums/categories, a show can't fall back to a "no venue" state.
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { count, error: showCheckError } = await supabase
            .from('shows')
            .select('id', { count: 'exact', head: true })
            .eq('venue_id', id);

        if (showCheckError) {
            console.error('Error checking venue usage:', showCheckError);
            return res.status(500).json({ error: 'Failed to check venue usage' });
        }

        if (count > 0) {
            return res.status(400).json({
                error: `Cannot delete this venue — ${count} show${count !== 1 ? 's' : ''} still reference it. Reassign or delete those shows first.`
            });
        }

        const { error } = await supabase
            .from('venues')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting venue:', error);
            return res.status(500).json({ error: 'Failed to delete venue' });
        }

        res.json({ message: 'Venue deleted successfully' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

