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
                jams_into,
                songs!setlist_songs_song_id_fkey (
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

            // ALL song metadata comes from the songs table (single source of truth)
            sets[setNum].push({
                // setlist_songs fields (junction table data only)
                id: item.id,
                song_id: item.song_id,
                order: item.song_order,
                notes: item.notes,  // Performance-specific notes
                jams_into: item.jams_into || null,  // UUID or null, NOT false
                // Song metadata from songs table
                title: item.songs?.title,
                is_original: item.songs?.is_original,
                original_artist: item.songs?.original_artist,
                written_by: item.songs?.written_by,
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
 * Body: { setlist: [{ song_id, set_number, song_order, is_encore, notes, jams_into }] }
 * Note: is_cover and original_artist are NO LONGER accepted - all song metadata comes from songs table
 */
router.put('/:id/setlist', async (req, res) => {
    try {
        const { id } = req.params;
        const { setlist } = req.body;

        // TODO: Add authentication middleware to verify admin status

        // If setlist is empty, delete all entries and return
        if (!setlist || setlist.length === 0) {
            const { error: deleteError } = await supabase
                .from('setlist_songs')
                .delete()
                .eq('show_id', id);

            if (deleteError) {
                console.error('[PUT /setlist] Error deleting setlist:', deleteError);
                return res.status(500).json({
                    error: 'Failed to clear setlist',
                    details: deleteError.message,
                    code: deleteError.code
                });
            }

            return res.json({ message: 'Setlist cleared successfully', setlist: [] });
        }

        // ============================================================
        // STEP 1: VALIDATE ALL DATA BEFORE TOUCHING THE DATABASE
        // ============================================================

        // Prepare setlist entries (validate data types)
        const setlistEntries = setlist.map((item, index) => {
            // Validate required fields
            if (!item.song_id) {
                throw new Error(`Entry ${index + 1}: song_id is required`);
            }
            if (typeof item.set_number !== 'number') {
                throw new Error(`Entry ${index + 1}: set_number must be a number`);
            }
            if (typeof item.song_order !== 'number') {
                throw new Error(`Entry ${index + 1}: song_order must be a number`);
            }

            // Validate UUID format for song_id
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(item.song_id)) {
                throw new Error(`Entry ${index + 1}: song_id is not a valid UUID`);
            }

            // Validate jams_into if provided (must be UUID or null, NOT false)
            const jamsInto = item.jams_into || null;
            if (jamsInto !== null && !uuidRegex.test(jamsInto)) {
                throw new Error(`Entry ${index + 1}: jams_into must be a valid UUID or null`);
            }

            return {
                show_id: id,
                song_id: item.song_id,
                set_number: item.set_number,
                song_order: item.song_order,
                is_encore: item.is_encore || false,
                notes: item.notes || null,
                jams_into: jamsInto
            };
        });

        // ============================================================
        // STEP 2: VERIFY ALL SONG REFERENCES EXIST
        // ============================================================

        // Collect all unique song IDs (both song_id and jams_into)
        const allSongIds = new Set();
        setlistEntries.forEach(entry => {
            allSongIds.add(entry.song_id);
            if (entry.jams_into) {
                allSongIds.add(entry.jams_into);
            }
        });

        // Query database to verify all songs exist
        const { data: existingSongs, error: songCheckError } = await supabase
            .from('songs')
            .select('id')
            .in('id', Array.from(allSongIds));

        if (songCheckError) {
            console.error('[PUT /setlist] Error checking song references:', songCheckError);
            return res.status(500).json({
                error: 'Failed to validate song references',
                details: songCheckError.message
            });
        }

        // Verify all song IDs exist
        const existingSongIds = new Set(existingSongs.map(s => s.id));
        const missingSongIds = Array.from(allSongIds).filter(id => !existingSongIds.has(id));

        if (missingSongIds.length > 0) {
            console.error('[PUT /setlist] Missing song references:', missingSongIds);
            return res.status(400).json({
                error: 'Invalid song references',
                message: 'Some songs do not exist in the database',
                missingSongIds: missingSongIds
            });
        }

        // ============================================================
        // STEP 3: VERIFY SHOW EXISTS
        // ============================================================

        const { data: show, error: showCheckError } = await supabase
            .from('shows')
            .select('id')
            .eq('id', id)
            .single();

        if (showCheckError || !show) {
            console.error('[PUT /setlist] Show not found:', id);
            return res.status(404).json({
                error: 'Show not found',
                message: `No show found with ID: ${id}`
            });
        }

        // ============================================================
        // STEP 4: ALL VALIDATION PASSED - NOW SAFE TO UPDATE
        // ============================================================

        // Delete existing setlist entries
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

        // Insert new setlist entries
        const { data: newSetlist, error: insertError } = await supabase
            .from('setlist_songs')
            .insert(setlistEntries)
            .select();

        if (insertError) {
            console.error('[PUT /setlist] Error inserting new setlist:', insertError);
            // This should never happen since we validated everything
            // But if it does, the old data is already deleted (unavoidable without transactions)
            return res.status(500).json({
                error: 'Failed to insert setlist',
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                code: insertError.code,
                warning: 'Old setlist data was deleted but new data failed to insert. Please try again.'
            });
        }

        res.json({ message: 'Setlist updated successfully', setlist: newSetlist });

    } catch (error) {
        console.error('[PUT /setlist] Unexpected error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * POST /api/shows/:id/setlist/song
 * Add a single song to a show's setlist (admin only)
 * Note: is_cover and original_artist are NO LONGER accepted - all song metadata comes from songs table
 */
router.post('/:id/setlist/song', async (req, res) => {
    try {
        const { id } = req.params;
        const { song_id, set_number, song_order, is_encore, notes, jams_into } = req.body;

        // TODO: Add authentication middleware to verify admin status

        // ============================================================
        // VALIDATE INPUT DATA
        // ============================================================

        // Validate required fields
        if (!song_id) {
            return res.status(400).json({ error: 'song_id is required' });
        }
        if (typeof set_number !== 'number') {
            return res.status(400).json({ error: 'set_number must be a number' });
        }
        if (typeof song_order !== 'number') {
            return res.status(400).json({ error: 'song_order must be a number' });
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(song_id)) {
            return res.status(400).json({ error: 'song_id must be a valid UUID' });
        }

        // Validate jams_into if provided (must be UUID or null, NOT false)
        const jamsIntoValue = jams_into || null;
        if (jamsIntoValue !== null && !uuidRegex.test(jamsIntoValue)) {
            return res.status(400).json({ error: 'jams_into must be a valid UUID or null' });
        }

        // ============================================================
        // VERIFY SONG REFERENCES EXIST
        // ============================================================

        // Collect song IDs to verify
        const songIdsToCheck = [song_id];
        if (jamsIntoValue) {
            songIdsToCheck.push(jamsIntoValue);
        }

        const { data: existingSongs, error: songCheckError } = await supabase
            .from('songs')
            .select('id')
            .in('id', songIdsToCheck);

        if (songCheckError) {
            console.error('[POST /setlist/song] Error checking song references:', songCheckError);
            return res.status(500).json({
                error: 'Failed to validate song references',
                details: songCheckError.message
            });
        }

        const existingSongIds = new Set(existingSongs.map(s => s.id));
        const missingSongIds = songIdsToCheck.filter(id => !existingSongIds.has(id));

        if (missingSongIds.length > 0) {
            return res.status(400).json({
                error: 'Invalid song references',
                message: 'Some songs do not exist in the database',
                missingSongIds: missingSongIds
            });
        }

        // ============================================================
        // VERIFY SHOW EXISTS
        // ============================================================

        const { data: show, error: showCheckError } = await supabase
            .from('shows')
            .select('id')
            .eq('id', id)
            .single();

        if (showCheckError || !show) {
            return res.status(404).json({
                error: 'Show not found',
                message: `No show found with ID: ${id}`
            });
        }

        // ============================================================
        // ALL VALIDATION PASSED - INSERT THE SONG
        // ============================================================

        const { data: setlistSong, error } = await supabase
            .from('setlist_songs')
            .insert([{
                show_id: id,
                song_id,
                set_number,
                song_order,
                is_encore: is_encore || false,
                notes: notes || null,  // Performance-specific notes only
                jams_into: jamsIntoValue  // UUID or null, NOT false
            }])
            .select()
            .single();

        if (error) {
            console.error('[POST /setlist/song] Error adding song to setlist:', error);
            return res.status(500).json({
                error: 'Failed to add song to setlist',
                details: error.message
            });
        }

        res.status(201).json(setlistSong);

    } catch (error) {
        console.error('[POST /setlist/song] Unexpected error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
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

