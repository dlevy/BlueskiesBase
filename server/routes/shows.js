const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

/**
 * GET /api/shows
 * Get all shows with pagination
 */
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const { data: shows, error, count } = await supabase
            .from('shows')
            .select(`
                *,
                venues (
                    id,
                    name,
                    city,
                    state_country,
                    address
                )
            `, { count: 'exact' })
            .order('show_date', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('Error fetching shows:', error);
            return res.status(500).json({ error: 'Failed to fetch shows' });
        }

        res.json({
            shows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/shows/:id
 * Get a single show with full setlist
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get show details
        const { data: show, error: showError } = await supabase
            .from('shows')
            .select(`
                *,
                venues (
                    id,
                    name,
                    city,
                    state_country,
                    address
                )
            `)
            .eq('id', id)
            .single();

        if (showError) {
            console.error('Error fetching show:', showError);
            return res.status(404).json({ error: 'Show not found' });
        }

        // Get setlist
        const { data: setlist, error: setlistError } = await supabase
            .from('setlist_songs')
            .select(`
                id,
                show_id,
                song_id,
                set_number,
                song_order,
                notes,
                is_encore,
                is_cover,
                original_artist,
                jams_into,
                songs (
                    id,
                    title,
                    original_artist,
                    is_original,
                    written_by
                )
            `)
            .eq('show_id', id)
            .order('set_number')
            .order('song_order');

        if (setlistError) {
            console.error('[GET /shows/:id] Error fetching setlist:', setlistError);
            console.error('[GET /shows/:id] Error details:', {
                message: setlistError.message,
                details: setlistError.details,
                hint: setlistError.hint,
                code: setlistError.code
            });
            // Don't fail the entire request if setlist fetch fails - just return empty setlist
            // This allows the show details to still display
            return res.json({
                ...show,
                setlist: {},
                setlist_error: setlistError.message
            });
        }

        // Organize setlist by sets
        const sets = {};
        setlist.forEach(item => {
            const setNum = item.is_encore ? 'encore' : `set${item.set_number}`;
            if (!sets[setNum]) {
                sets[setNum] = [];
            }
            sets[setNum].push({
                // Include the setlist_songs fields
                id: item.id,  // setlist_songs.id
                song_id: item.song_id,  // CRITICAL: The foreign key to songs table
                order: item.song_order,
                notes: item.notes,
                is_cover: item.is_cover || false,
                original_artist: item.original_artist || null,
                jams_into: item.jams_into || false,
                // Include the song details from the songs table
                title: item.songs?.title,
                songs: item.songs  // Keep the full song object for backward compatibility
            });
        });

        res.json({
            ...show,
            setlist: sets
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/shows
 * Create a new show (admin only)
 */
router.post('/', async (req, res) => {
    try {
        const { venue_id, show_date, artist_name, tour_name, notes, has_images, source_types } = req.body;

        // TODO: Add authentication middleware to verify admin status

        const { data: show, error } = await supabase
            .from('shows')
            .insert([{
                venue_id,
                show_date,
                artist_name,
                tour_name,
                notes,
                has_images,
                source_types
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating show:', error);
            return res.status(500).json({ error: 'Failed to create show' });
        }

        res.status(201).json(show);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/shows/:id
 * Update a show (admin only)
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { venue_id, show_date, artist_name, tour_name, notes, has_images, source_types } = req.body;

        // TODO: Add authentication middleware to verify admin status

        const { data: show, error } = await supabase
            .from('shows')
            .update({
                venue_id,
                show_date,
                artist_name,
                tour_name,
                notes,
                has_images,
                source_types
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating show:', error);
            return res.status(500).json({ error: 'Failed to update show' });
        }

        res.json(show);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/shows/:id
 * Delete a show (admin only)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // TODO: Add authentication middleware to verify admin status

        const { error } = await supabase
            .from('shows')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting show:', error);
            return res.status(500).json({ error: 'Failed to delete show' });
        }

        res.json({ message: 'Show deleted successfully' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/shows/:id/setlist
 * Update the entire setlist for a show (admin only)
 * Body: { setlist: [{ song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into }] }
 */
router.put('/:id/setlist', async (req, res) => {
    try {
        const { id } = req.params;
        const { setlist } = req.body;

        console.log('[PUT /setlist] Updating setlist for show:', id);
        console.log('[PUT /setlist] Setlist data:', JSON.stringify(setlist, null, 2));

        // TODO: Add authentication middleware to verify admin status

        // First, delete all existing setlist entries for this show
        const { error: deleteError } = await supabase
            .from('setlist_songs')
            .delete()
            .eq('show_id', id);

        if (deleteError) {
            console.error('[PUT /setlist] Error deleting old setlist:', deleteError);
            return res.status(500).json({
                error: 'Failed to update setlist',
                details: deleteError.message,
                code: deleteError.code
            });
        }

        // If setlist is empty, just return success
        if (!setlist || setlist.length === 0) {
            console.log('[PUT /setlist] Empty setlist, returning success');
            return res.json({ message: 'Setlist updated successfully', setlist: [] });
        }

        // Insert new setlist entries
        const setlistEntries = setlist.map(item => ({
            show_id: id,
            song_id: item.song_id,
            set_number: item.set_number,
            song_order: item.song_order,
            is_encore: item.is_encore || false,
            notes: item.notes || null,
            is_cover: item.is_cover || false,
            original_artist: item.original_artist || null,
            jams_into: item.jams_into || false
        }));

        console.log('[PUT /setlist] Inserting entries:', JSON.stringify(setlistEntries, null, 2));

        const { data: newSetlist, error: insertError } = await supabase
            .from('setlist_songs')
            .insert(setlistEntries)
            .select();

        if (insertError) {
            console.error('[PUT /setlist] Error inserting new setlist:', insertError);
            console.error('[PUT /setlist] Error details:', {
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                code: insertError.code
            });
            return res.status(500).json({
                error: 'Failed to update setlist',
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                code: insertError.code
            });
        }

        console.log('[PUT /setlist] Successfully updated setlist');
        res.json({ message: 'Setlist updated successfully', setlist: newSetlist });

    } catch (error) {
        console.error('[PUT /setlist] Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

/**
 * POST /api/shows/:id/setlist/song
 * Add a single song to a show's setlist (admin only)
 */
router.post('/:id/setlist/song', async (req, res) => {
    try {
        const { id } = req.params;
        const { song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into } = req.body;

        // TODO: Add authentication middleware to verify admin status

        const { data: setlistSong, error } = await supabase
            .from('setlist_songs')
            .insert([{
                show_id: id,
                song_id,
                set_number,
                song_order,
                is_encore: is_encore || false,
                notes: notes || null,
                is_cover: is_cover || false,
                original_artist: original_artist || null,
                jams_into: jams_into || false
            }])
            .select()
            .single();

        if (error) {
            console.error('Error adding song to setlist:', error);
            return res.status(500).json({ error: 'Failed to add song to setlist' });
        }

        res.status(201).json(setlistSong);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/shows/:showId/setlist/:setlistId
 * Remove a song from a show's setlist (admin only)
 */
router.delete('/:showId/setlist/:setlistId', async (req, res) => {
    try {
        const { setlistId } = req.params;

        // TODO: Add authentication middleware to verify admin status

        const { error } = await supabase
            .from('setlist_songs')
            .delete()
            .eq('id', setlistId);

        if (error) {
            console.error('Error removing song from setlist:', error);
            return res.status(500).json({ error: 'Failed to remove song from setlist' });
        }

        res.json({ message: 'Song removed from setlist successfully' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

