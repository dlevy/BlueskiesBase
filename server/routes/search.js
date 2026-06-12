const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

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
 *   - hasNotes: Filter by shows with user notes (true/false)
 *   - hasPhotos: Filter by shows with user photos (true/false)
 *   - hasPoster: Filter by shows with user posters (true/false)
 */
router.get('/shows', async (req, res) => {
    try {
        const { year, month, day, venue, city, state, song, source, hasImages, hasNotes, hasPhotos, hasPoster } = req.query;

        // Handle content-based filters (hasNotes, hasPhotos, hasPoster)
        // These require querying the user_notes, user_photos, user_posters tables first
        let contentFilteredShowIds = null;

        if (hasNotes === 'true' || hasPhotos === 'true' || hasPoster === 'true') {
            console.log('[Search] Content filters detected:', { hasNotes, hasPhotos, hasPoster });

            let showIdsWithNotes = new Set();
            let showIdsWithPhotos = new Set();
            let showIdsWithPosters = new Set();

            // Query for shows with notes
            if (hasNotes === 'true') {
                const { data: notesData, error: notesError } = await supabase
                    .from('user_notes')
                    .select('show_id');

                if (notesError) {
                    console.error('[Search] Error fetching notes:', notesError);
                } else if (notesData) {
                    notesData.forEach(n => showIdsWithNotes.add(n.show_id));
                    console.log('[Search] Found', showIdsWithNotes.size, 'shows with notes');
                }
            }

            // Query for shows with photos
            if (hasPhotos === 'true') {
                const { data: photosData, error: photosError } = await supabase
                    .from('user_photos')
                    .select('show_id');

                if (photosError) {
                    console.error('[Search] Error fetching photos:', photosError);
                } else if (photosData) {
                    photosData.forEach(p => showIdsWithPhotos.add(p.show_id));
                    console.log('[Search] Found', showIdsWithPhotos.size, 'shows with photos');
                }
            }

            // Query for shows with posters
            if (hasPoster === 'true') {
                const { data: postersData, error: postersError } = await supabase
                    .from('user_posters')
                    .select('show_id');

                if (postersError) {
                    console.error('[Search] Error fetching posters:', postersError);
                } else if (postersData) {
                    postersData.forEach(p => showIdsWithPosters.add(p.show_id));
                    console.log('[Search] Found', showIdsWithPosters.size, 'shows with posters');
                }
            }

            // Combine the sets based on which filters are active
            // If multiple content filters are active, we want shows that match ALL of them (AND logic)
            let combinedShowIds = null;

            if (hasNotes === 'true') {
                combinedShowIds = showIdsWithNotes;
            }

            if (hasPhotos === 'true') {
                if (combinedShowIds === null) {
                    combinedShowIds = showIdsWithPhotos;
                } else {
                    // Intersection: only shows that have BOTH notes and photos
                    combinedShowIds = new Set([...combinedShowIds].filter(id => showIdsWithPhotos.has(id)));
                }
            }

            if (hasPoster === 'true') {
                if (combinedShowIds === null) {
                    combinedShowIds = showIdsWithPosters;
                } else {
                    // Intersection: only shows that have posters AND previous filters
                    combinedShowIds = new Set([...combinedShowIds].filter(id => showIdsWithPosters.has(id)));
                }
            }

            contentFilteredShowIds = Array.from(combinedShowIds || []);
            console.log('[Search] After combining content filters:', contentFilteredShowIds.length, 'shows');

            // If no shows match the content filters, return empty results
            if (contentFilteredShowIds.length === 0) {
                return res.json({
                    count: 0,
                    shows: []
                });
            }
        }

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

        // If we have content-filtered show IDs, apply them
        if (contentFilteredShowIds !== null) {
            query = query.in('id', contentFilteredShowIds);
        }

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
            return res.status(500).json({ error: 'Failed to search shows', detail: error.message, hint: error.hint, code: error.code });
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

            // Now find all shows that have this song with pagination (popular songs may have 1000+ performances)
            let allSetlistSongs = [];
            let rangeStart = 0;
            const PAGE_SIZE = 1000;
            let hasMore = true;

            while (hasMore) {
                const rangeEnd = rangeStart + PAGE_SIZE - 1;

                const { data: pageData, error: songError, count } = await supabase
                    .from('setlist_songs')
                    .select('show_id', { count: 'exact' })
                    .eq('song_id', songData.id)
                    .range(rangeStart, rangeEnd);

                if (songError) {
                    console.error('Song search error:', songError);
                    return res.status(500).json({ error: 'Failed to search by song' });
                }

                if (pageData && pageData.length > 0) {
                    allSetlistSongs = allSetlistSongs.concat(pageData);
                    rangeStart += PAGE_SIZE;

                    if (pageData.length < PAGE_SIZE || allSetlistSongs.length >= count) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            const setlistSongs = allSetlistSongs;

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

