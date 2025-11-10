const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

/**
 * GET /api/search/shows
 * Search for shows with various filters
 * Query params:
 *   - year: Filter by year
 *   - month: Filter by month (1-12)
 *   - day: Filter by day (1-31)
 *   - venue: Filter by venue name (partial match)
 *   - city: Filter by city (partial match)
 *   - state: Filter by state/country (partial match)
 *   - song: Filter by song title (shows containing this song)
 *   - source: Filter by source type (AUD, SBD, VIDEO, etc.)
 *   - hasImages: Filter by shows with images (true/false)
 */
router.get('/shows', async (req, res) => {
    try {
        const { year, month, day, venue, city, state, song, source, hasImages } = req.query;

        // Start building the query
        let query = supabase
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
            .order('show_date', { ascending: false });

        // Apply date filters
        if (year && !month) {
            // Year only - filter by entire year
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            query = query.gte('show_date', startDate).lte('show_date', endDate);
        } else if (month && year) {
            // Year and month - filter by specific month
            const startDate = `${year}-${month.padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
            query = query.gte('show_date', startDate).lte('show_date', endDate);
        } else if (month && !year) {
            // Month only - filter by month across all years
            // We'll need to do this with in-memory filtering after the query
        }

        if (day && month && year) {
            const searchDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            query = query.eq('show_date', searchDate);
        }

        // Apply venue/location filters
        if (venue) {
            // This will need to be done with a join or separate query
            // For now, we'll fetch and filter in memory
        }

        if (hasImages === 'true') {
            query = query.eq('has_images', true);
        }

        if (source) {
            query = query.contains('source_types', [source]);
        }

        // Execute the query
        const { data: shows, error } = await query;

        if (error) {
            console.error('Search error:', error);
            return res.status(500).json({ error: 'Failed to search shows' });
        }

        // Filter by venue/city/state if needed (in-memory filtering)
        let filteredShows = shows;

        // Filter by month only (across all years) if month is selected without year
        if (month && !year && filteredShows) {
            filteredShows = filteredShows.filter(show => {
                const showDate = new Date(show.show_date);
                const showMonth = showDate.getMonth() + 1; // getMonth() returns 0-11
                return showMonth === parseInt(month);
            });
        }

        if (venue && filteredShows) {
            // Use exact match for venue name (from dropdown)
            filteredShows = filteredShows.filter(show =>
                show.venues?.name === venue
            );
        }

        if (city && filteredShows) {
            // Use exact match for city (from dropdown)
            filteredShows = filteredShows.filter(show =>
                show.venues?.city === city
            );
        }

        if (state && filteredShows) {
            filteredShows = filteredShows.filter(show =>
                show.venues?.state_country.toLowerCase().includes(state.toLowerCase())
            );
        }

        // If searching by song, we need to join with setlist_songs
        if (song) {
            // First, find the song ID by exact title match
            const { data: songData, error: songLookupError } = await supabase
                .from('songs')
                .select('id')
                .eq('title', song)
                .single();

            if (songLookupError || !songData) {
                console.error('Song lookup error:', songLookupError);
                // If song not found, return empty results
                return res.json({
                    count: 0,
                    shows: []
                });
            }

            // Now find all shows that have this song
            const { data: setlistSongs, error: songError } = await supabase
                .from('setlist_songs')
                .select('show_id')
                .eq('song_id', songData.id);

            if (songError) {
                console.error('Song search error:', songError);
                return res.status(500).json({ error: 'Failed to search by song' });
            }

            const showIdsWithSong = new Set(setlistSongs.map(s => s.show_id));
            filteredShows = filteredShows.filter(show => showIdsWithSong.has(show.id));
        }

        res.json({
            count: filteredShows.length,
            shows: filteredShows
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/search/songs
 * Search for songs
 * Query params:
 *   - title: Search by song title (partial match)
 *   - original: Filter by original songs only (true/false)
 */
router.get('/songs', async (req, res) => {
    try {
        const { title, original } = req.query;

        let query = supabase
            .from('songs')
            .select('*')
            .order('title');

        if (title) {
            query = query.ilike('title', `%${title}%`);
        }

        if (original === 'true') {
            query = query.eq('is_original', true);
        } else if (original === 'false') {
            query = query.eq('is_original', false);
        }

        const { data: songs, error } = await query;

        if (error) {
            console.error('Song search error:', error);
            return res.status(500).json({ error: 'Failed to search songs' });
        }

        res.json({
            count: songs.length,
            songs
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

