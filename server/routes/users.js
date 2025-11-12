const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

/**
 * POST /api/users/check-attendance-batch
 * Check attendance for multiple shows at once
 * Requires authentication
 * Body: { showIds: [1, 2, 3, ...] }
 * Returns: { attendance: { 1: true, 2: false, 3: true, ... } }
 */
router.post('/check-attendance-batch', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { showIds } = req.body;
        if (!showIds || !Array.isArray(showIds) || showIds.length === 0) {
            return res.status(400).json({ error: 'showIds array is required' });
        }

        console.log(`[check-attendance-batch] Checking ${showIds.length} shows for user ${user.id}`);

        // If there are too many show IDs, we need to batch the query
        // PostgreSQL/Supabase has limits on IN clause size
        const BATCH_SIZE = 100;
        let allUserShows = [];

        if (showIds.length > BATCH_SIZE) {
            // Process in batches
            for (let i = 0; i < showIds.length; i += BATCH_SIZE) {
                const batch = showIds.slice(i, i + BATCH_SIZE);
                const { data: batchUserShows, error } = await supabase
                    .from('user_shows')
                    .select('show_id')
                    .eq('user_id', user.id)
                    .in('show_id', batch);

                if (error) {
                    console.error('Error checking attendance batch:', error);
                    return res.status(500).json({ error: 'Failed to check attendance' });
                }

                allUserShows = allUserShows.concat(batchUserShows || []);
            }
        } else {
            // Single query for small batches
            const { data: userShows, error } = await supabase
                .from('user_shows')
                .select('show_id')
                .eq('user_id', user.id)
                .in('show_id', showIds);

            if (error) {
                console.error('Error checking attendance:', error);
                return res.status(500).json({ error: 'Failed to check attendance' });
            }

            allUserShows = userShows || [];
        }

        // Create a map of show_id -> true for attended shows
        const attendanceMap = {};
        showIds.forEach(showId => {
            attendanceMap[showId] = false; // Default to false
        });

        allUserShows.forEach(userShow => {
            attendanceMap[userShow.show_id] = true;
        });

        console.log(`[check-attendance-batch] Found ${allUserShows.length} attended shows out of ${showIds.length}`);
        res.json({ attendance: attendanceMap });
    } catch (error) {
        console.error('Error in check-attendance-batch:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/attended-shows
 * Get all shows the user has marked as attended
 * Requires authentication
 */
router.get('/attended-shows', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get all shows the user has attended
        const { data: userShows, error } = await supabase
            .from('user_shows')
            .select(`
                id,
                show_id,
                marked_at,
                shows (
                    id,
                    show_date,
                    artist_name,
                    tour_name,
                    venues (
                        name,
                        city,
                        state_country
                    )
                )
            `)
            .eq('user_id', user.id)
            .order('shows(show_date)', { ascending: false });

        if (error) {
            console.error('Error fetching attended shows:', error);
            return res.status(500).json({ error: 'Failed to fetch attended shows' });
        }

        res.json({ shows: userShows || [] });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/users/attended-shows/:showId
 * Mark a show as attended
 * Requires authentication
 */
router.post('/attended-shows/:showId', async (req, res) => {
    try {
        const { showId } = req.params;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Insert the user_show record
        const { data, error } = await supabase
            .from('user_shows')
            .insert([{ user_id: user.id, show_id: showId }])
            .select()
            .single();

        if (error) {
            // Check if it's a duplicate
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Show already marked as attended' });
            }
            console.error('Error marking show as attended:', error);
            return res.status(500).json({ error: 'Failed to mark show as attended' });
        }

        res.status(201).json(data);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/users/attended-shows/:showId
 * Unmark a show as attended
 * Requires authentication
 */
router.delete('/attended-shows/:showId', async (req, res) => {
    try {
        const { showId } = req.params;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Delete the user_show record
        const { error } = await supabase
            .from('user_shows')
            .delete()
            .eq('user_id', user.id)
            .eq('show_id', showId);

        if (error) {
            console.error('Error unmarking show:', error);
            return res.status(500).json({ error: 'Failed to unmark show' });
        }

        res.json({ message: 'Show unmarked successfully' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/stats
 * Get user statistics (attended shows, songs seen, songs not seen)
 * Requires authentication
 */
router.get('/stats', async (req, res) => {
    try {
        console.log('[Stats] Request received');
        const startTime = Date.now();

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.log('[Stats] No authorization header');
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');

        console.log('[Stats] Authenticating user...');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.log('[Stats] Authentication failed:', authError?.message);
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log(`[Stats] User authenticated: ${user.email}`);

        // Get all attended shows with their setlists
        console.log('[Stats] Fetching attended shows...');
        const { data: attendedShows, error: showsError } = await supabase
            .from('user_shows')
            .select(`
                show_id,
                shows (
                    id,
                    show_date,
                    artist_name,
                    tour_name,
                    venues (
                        name,
                        city,
                        state_country
                    )
                )
            `)
            .eq('user_id', user.id);

        if (showsError) {
            console.error('[Stats] Error fetching attended shows:', showsError);
            return res.status(500).json({ error: 'Failed to fetch statistics' });
        }

        console.log(`[Stats] Found ${attendedShows?.length || 0} attended shows`);
        const attendedShowIds = attendedShows.map(us => us.show_id);

        // Get all songs from attended shows
        // Need to paginate to get all records
        let songsSeen = [];
        if (attendedShowIds.length > 0) {
            console.log('[Stats] Fetching songs from attended shows...');
            let allSetlistSongs = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                console.log(`[Stats] Fetching songs page ${page + 1}...`);
                const { data: setlistSongs, error: songsError } = await supabase
                    .from('setlist_songs')
                    .select(`
                        song_id,
                        show_id,
                        songs!setlist_songs_song_id_fkey (
                            id,
                            title,
                            is_original,
                            original_artist
                        )
                    `)
                    .in('show_id', attendedShowIds)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (songsError) {
                    console.error('[Stats] Error fetching songs:', songsError);
                    break;
                }

                if (setlistSongs && setlistSongs.length > 0) {
                    allSetlistSongs = allSetlistSongs.concat(setlistSongs);
                    console.log(`[Stats] Page ${page + 1}: ${setlistSongs.length} records, total: ${allSetlistSongs.length}`);
                    page++;
                    hasMore = setlistSongs.length === pageSize;
                } else {
                    hasMore = false;
                }
            }
            console.log(`[Stats] Total setlist songs fetched: ${allSetlistSongs.length}`);

            // Get unique songs with play count (count once per show, not per performance)
            const songPlayCount = new Map();
            allSetlistSongs.forEach(ss => {
                if (ss.songs) {
                    const key = `${ss.song_id}-${ss.show_id}`;
                    if (!songPlayCount.has(ss.song_id)) {
                        songPlayCount.set(ss.song_id, {
                            ...ss.songs,
                            playCount: 1,
                            showIds: new Set([ss.show_id])
                        });
                    } else {
                        const existing = songPlayCount.get(ss.song_id);
                        // Only increment if this is a new show
                        if (!existing.showIds.has(ss.show_id)) {
                            existing.playCount++;
                            existing.showIds.add(ss.show_id);
                        }
                    }
                }
            });
            // Remove showIds before sending to client
            songsSeen = Array.from(songPlayCount.values()).map(song => {
                const { showIds, ...songData } = song;
                return songData;
            });
        }

        // Get all songs that have been played at least once (not orphan songs)
        // Need to paginate to get all records since we have 5000+ setlist_songs
        console.log('[Stats] Fetching all played songs...');
        let allPlayedSongsData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            console.log(`[Stats] Fetching played songs page ${page + 1}...`);
            const { data: playedSongsData, error: playedSongsError } = await supabase
                .from('setlist_songs')
                .select(`
                    song_id,
                    songs!setlist_songs_song_id_fkey!inner (
                        id,
                        title,
                        is_original,
                        original_artist
                    )
                `)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (playedSongsError) {
                console.error('[Stats] Error fetching played songs:', playedSongsError);
                return res.status(500).json({ error: 'Failed to fetch statistics' });
            }

            if (playedSongsData && playedSongsData.length > 0) {
                allPlayedSongsData = allPlayedSongsData.concat(playedSongsData);
                console.log(`[Stats] Page ${page + 1}: ${playedSongsData.length} records, total: ${allPlayedSongsData.length}`);
                page++;
                hasMore = playedSongsData.length === pageSize;
            } else {
                hasMore = false;
            }
        }
        console.log(`[Stats] Total played songs records fetched: ${allPlayedSongsData.length}`);

        // Get unique songs that have been played
        const uniquePlayedSongs = new Map();
        allPlayedSongsData.forEach(ps => {
            if (ps.songs && !uniquePlayedSongs.has(ps.song_id)) {
                uniquePlayedSongs.set(ps.song_id, ps.songs);
            }
        });
        const allPlayedSongs = Array.from(uniquePlayedSongs.values()).sort((a, b) =>
            a.title.localeCompare(b.title)
        );

        // Calculate songs not seen (played songs that user hasn't seen)
        const seenSongIds = new Set(songsSeen.map(s => s.id));
        const songsNotSeenBasic = allPlayedSongs.filter(song => !seenSongIds.has(song.id));

        // Get the most recent show for each song not seen (optimized - single query)
        let songsNotSeenWithShow = [];

        if (songsNotSeenBasic.length > 0) {
            const notSeenSongIds = songsNotSeenBasic.map(s => s.id);

            // Get all setlist_songs for songs not seen with show info (with pagination)
            let allNotSeenSetlistData = [];
            let rangeStart = 0;
            const PAGE_SIZE = 1000;
            let hasMore = true;

            while (hasMore) {
                const rangeEnd = rangeStart + PAGE_SIZE - 1;

                const { data: pageData, error: notSeenError, count } = await supabase
                    .from('setlist_songs')
                    .select(`
                        song_id,
                        show_id,
                        shows!inner (
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
                    .in('song_id', notSeenSongIds)
                    .order('shows(show_date)', { ascending: false })
                    .range(rangeStart, rangeEnd);

                if (notSeenError) {
                    console.error('Error fetching not seen shows page:', notSeenError);
                    break;
                }

                if (pageData && pageData.length > 0) {
                    allNotSeenSetlistData = allNotSeenSetlistData.concat(pageData);
                    rangeStart += PAGE_SIZE;

                    if (pageData.length < PAGE_SIZE || allNotSeenSetlistData.length >= count) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            const notSeenSetlistData = allNotSeenSetlistData;

            // Group by song_id and get the most recent show for each
            const songToMostRecentShow = new Map();
            if (notSeenSetlistData) {
                notSeenSetlistData.forEach(item => {
                    if (!songToMostRecentShow.has(item.song_id)) {
                        songToMostRecentShow.set(item.song_id, item.shows);
                    }
                });
            }

            // Combine song data with most recent show
            songsNotSeenWithShow = songsNotSeenBasic.map(song => ({
                ...song,
                mostRecentShow: songToMostRecentShow.get(song.id) || null
            }));
        }

        const endTime = Date.now();
        const duration = endTime - startTime;
        console.log(`[Stats] ✅ Request completed in ${duration}ms`);
        console.log(`[Stats] Shows: ${attendedShows.length}, Songs Seen: ${songsSeen.length}, Songs Not Seen: ${songsNotSeenWithShow.length}`);

        const response = {
            totalShowsAttended: attendedShows.length,
            attendedShows: attendedShows.map(us => us.shows),
            songsSeen: songsSeen,
            songsNotSeen: songsNotSeenWithShow,
            totalSongsSeen: songsSeen.length,
            totalSongsNotSeen: songsNotSeenWithShow.length
        };

        console.log('[Stats] Sending response...');
        res.json(response);

    } catch (error) {
        console.error('[Stats] ❌ Error:', error);
        console.error('[Stats] Error stack:', error.stack);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/users/check-attendance/:showId
 * Check if user has marked a specific show as attended
 * Requires authentication
 */
router.get('/check-attendance/:showId', async (req, res) => {
    try {
        const { showId } = req.params;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabase
            .from('user_shows')
            .select('id')
            .eq('user_id', user.id)
            .eq('show_id', showId)
            .maybeSingle();

        if (error) {
            console.error('Error checking attendance:', error);
            return res.status(500).json({ error: 'Failed to check attendance' });
        }

        res.json({ attended: !!data });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

