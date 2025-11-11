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
 * GET /api/songs/stats/global
 * Get global song statistics (covers and originals)
 */
router.get('/stats/global', async (req, res) => {
    try {
        console.log('[Song Stats] Fetching global song statistics...');

        // Get all setlist_songs with song info (use range to bypass 1000 row limit)
        const { data: setlistSongs, error: setlistError } = await supabase
            .from('setlist_songs')
            .select(`
                show_id,
                song_id,
                songs (
                    id,
                    title,
                    is_original,
                    original_artist
                )
            `)
            .range(0, 9999); // Get up to 10,000 rows (we have ~5,836)

        if (setlistError) {
            console.error('[Song Stats] Error fetching setlist songs:', setlistError);
            console.error('[Song Stats] Error details:', JSON.stringify(setlistError, null, 2));
            return res.status(500).json({ error: 'Failed to fetch song statistics', details: setlistError.message });
        }

        console.log(`[Song Stats] Fetched ${setlistSongs?.length || 0} setlist songs`);

        // Get all shows to get dates
        const { data: shows, error: showsError } = await supabase
            .from('shows')
            .select('id, show_date')
            .range(0, 999); // Get up to 1000 shows (we have ~302)

        if (showsError) {
            console.error('[Song Stats] Error fetching shows:', showsError);
            console.error('[Song Stats] Error details:', JSON.stringify(showsError, null, 2));
            return res.status(500).json({ error: 'Failed to fetch show dates', details: showsError.message });
        }

        console.log(`[Song Stats] Fetched ${shows?.length || 0} shows`);

        // Create a map of show_id -> show_date for quick lookup
        const showDates = {};
        shows.forEach(show => {
            showDates[show.id] = show.show_date;
        });

        // Count unique plays per song (one per show) and track last played date
        const songPlayCounts = {};

        setlistSongs.forEach(ss => {
            if (!ss.songs) return;

            const songId = ss.songs.id;
            const showId = ss.show_id;
            const showDate = showDates[showId];

            if (!showDate) return; // Skip if show date not found

            if (!songPlayCounts[songId]) {
                songPlayCounts[songId] = {
                    id: songId,
                    title: ss.songs.title,
                    is_original: ss.songs.is_original,
                    original_artist: ss.songs.original_artist,
                    shows: new Set(),
                    lastPlayed: showDate
                };
            }

            songPlayCounts[songId].shows.add(showId);

            // Update last played date if this show is more recent
            if (new Date(showDate) > new Date(songPlayCounts[songId].lastPlayed)) {
                songPlayCounts[songId].lastPlayed = showDate;
            }
        });

        // Convert to array with play counts and last played date
        const songsWithCounts = Object.values(songPlayCounts).map(song => ({
            id: song.id,
            title: song.title,
            is_original: song.is_original,
            original_artist: song.original_artist,
            playCount: song.shows.size,
            lastPlayed: song.lastPlayed
        }));

        // Separate covers and originals
        const covers = songsWithCounts.filter(s => s.is_original === false);
        const originals = songsWithCounts.filter(s => s.is_original === true);

        // Sort by play count
        covers.sort((a, b) => b.playCount - a.playCount);
        originals.sort((a, b) => b.playCount - a.playCount);

        // Get top 5 and rarest 5
        const topCovers = covers.slice(0, 5);
        const rarestCovers = covers.slice(-5).reverse();
        const topOriginals = originals.slice(0, 5);
        const rarestOriginals = originals.slice(-5).reverse();

        const stats = {
            covers: {
                total: covers.length,
                top5: topCovers,
                rarest5: rarestCovers
            },
            originals: {
                total: originals.length,
                top5: topOriginals,
                rarest5: rarestOriginals
            }
        };

        console.log(`[Song Stats] ✅ Stats calculated: ${covers.length} covers, ${originals.length} originals`);
        res.json(stats);

    } catch (error) {
        console.error('[Song Stats] Error:', error);
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

