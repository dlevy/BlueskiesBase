const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { computeGlobalSongStats } = require('../utils/songStats');

/**
 * GET /api/songs
 * Get all songs with performance counts
 */
router.get('/', async (req, res) => {
    try {
        // Try to include album data via junction table; fall back to basic fetch if table doesn't exist
        let songs;
        const { data: songsWithAlbums, error: joinError } = await supabase
            .from('songs')
            .select('*, album_songs(album_id, albums(id, title, release_date))')
            .order('title');

        if (joinError) {
            const { data: basicSongs, error: basicError } = await supabase
                .from('songs')
                .select('*')
                .order('title');
            if (basicError) {
                console.error('Error fetching songs:', basicError);
                return res.status(500).json({ error: 'Failed to fetch songs' });
            }
            songs = basicSongs || [];
        } else {
            songs = songsWithAlbums || [];
        }

        // Get performance counts for each song (count unique shows)
        const songIds = songs.map(s => s.id);

        // Fetch ALL setlist_songs entries using batch fetching to avoid 1000-row limit
        let allSetlistSongs = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: batch, error: batchError } = await supabase
                .from('setlist_songs')
                .select('song_id, show_id, performance_type')
                .in('song_id', songIds)
                .order('id')
                .range(from, from + batchSize - 1);

            if (batchError) {
                console.error('Error fetching setlist songs batch:', batchError);
                break;
            }

            if (batch && batch.length > 0) {
                allSetlistSongs = allSetlistSongs.concat(batch);
                hasMore = batch.length === batchSize;
                from += batchSize;
            } else {
                hasMore = false;
            }
        }

        // Count unique shows per song
        const performanceCounts = {};
        if (allSetlistSongs.length > 0) {
            allSetlistSongs.forEach(entry => {
                if (!performanceCounts[entry.song_id]) {
                    performanceCounts[entry.song_id] = new Set();
                }
                performanceCounts[entry.song_id].add(entry.show_id);
            });
        }

        // Add performance_count to each song
        const songsWithCounts = songs.map(song => ({
            ...song,
            performance_count: performanceCounts[song.id] ? performanceCounts[song.id].size : 0
        }));

        res.json({ songs: songsWithCounts });

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
        const stats = await computeGlobalSongStats(10);
        console.log(`[Song Stats] ✅ Stats calculated: ${stats.covers.total} covers, ${stats.originals.total} originals`);
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

        // Get all performances of this song with pagination (popular songs may have 1000+ performances)
        let allPerformances = [];
        let rangeStart = 0;
        const PAGE_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
            const rangeEnd = rangeStart + PAGE_SIZE - 1;

            const { data: pageData, error: perfError, count } = await supabase
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
                `, { count: 'exact' })
                .eq('song_id', id)
                .order('shows(show_date)', { ascending: false })
                .order('id')
                .range(rangeStart, rangeEnd);

            if (perfError) {
                console.error('Error fetching performances page:', perfError);
                return res.status(500).json({ error: 'Failed to fetch performances' });
            }

            if (pageData && pageData.length > 0) {
                allPerformances = allPerformances.concat(pageData);
                rangeStart += PAGE_SIZE;

                if (pageData.length < PAGE_SIZE || allPerformances.length >= count) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        const performances = allPerformances;

        // Calculate performance type counts
        const performanceTypeCounts = {
            full: 0,
            tease: 0,
            partial: 0
        };

        performances.forEach(perf => {
            const perfType = perf.performance_type || 'full';
            if (performanceTypeCounts.hasOwnProperty(perfType)) {
                performanceTypeCounts[perfType]++;
            }
        });

        res.json({
            ...song,
            performances,
            performance_type_counts: performanceTypeCounts,
            total_performances: performances.length
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
        const { title, original_artist, is_original, written_by, lyrics, notes, album_id } = req.body;

        // TODO: Add authentication middleware to verify admin status

        const { data: song, error } = await supabase
            .from('songs')
            .insert([{ title, original_artist, is_original, written_by, lyrics, notes, album_id: album_id || null }])
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
        const { title, original_artist, is_original, written_by, lyrics, notes, album_id, track_order } = req.body;

        // TODO: Add authentication middleware to verify admin status

        const { data: song, error } = await supabase
            .from('songs')
            .update({ title, original_artist, is_original, written_by, lyrics, notes, album_id: album_id || null, track_order, updated_at: new Date() })
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
 * WARNING: Before running the fix_song_delete_cascade.sql migration, this will CASCADE DELETE
 * all setlist_songs entries! After the migration, it will properly RESTRICT deletion.
 *
 * This endpoint checks if the song is used in setlists and prevents deletion if so.
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // TODO: Add authentication middleware to verify admin status

        // Check if song is used in any setlists
        const { data: usages, error: usageError } = await supabase
            .from('setlist_songs')
            .select('id, show_id')
            .eq('song_id', id);

        if (usageError) {
            console.error('Error checking song usage:', usageError);
            return res.status(500).json({ error: 'Failed to check song usage' });
        }

        if (usages && usages.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete song that is used in setlists',
                message: `This song appears in ${usages.length} setlist(s) and cannot be deleted. Remove it from all setlists first.`,
                usageCount: usages.length
            });
        }

        const { error } = await supabase
            .from('songs')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting song:', error);

            // Check if it's a foreign key constraint error
            if (error.code === '23503') {
                return res.status(400).json({
                    error: 'Cannot delete song',
                    message: 'This song is still referenced in setlists. Please remove it from all setlists first.'
                });
            }

            return res.status(500).json({ error: 'Failed to delete song' });
        }

        res.json({ message: 'Song deleted successfully' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

