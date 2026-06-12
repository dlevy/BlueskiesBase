const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { year, month, day, venue, city, state, song, source, hasImages, hasNotes, hasPhotos, hasPoster } = req.query;

        let contentFilteredShowIds = null;

        if (hasNotes === 'true' || hasPhotos === 'true' || hasPoster === 'true') {
            let showIdsWithNotes = new Set();
            let showIdsWithPhotos = new Set();
            let showIdsWithPosters = new Set();

            if (hasNotes === 'true') {
                const { data } = await supabase.from('user_notes').select('show_id');
                if (data) data.forEach(n => showIdsWithNotes.add(n.show_id));
            }
            if (hasPhotos === 'true') {
                const { data } = await supabase.from('user_photos').select('show_id');
                if (data) data.forEach(p => showIdsWithPhotos.add(p.show_id));
            }
            if (hasPoster === 'true') {
                const { data } = await supabase.from('user_posters').select('show_id');
                if (data) data.forEach(p => showIdsWithPosters.add(p.show_id));
            }

            let combinedShowIds = null;
            if (hasNotes === 'true') combinedShowIds = showIdsWithNotes;
            if (hasPhotos === 'true') {
                combinedShowIds = combinedShowIds === null ? showIdsWithPhotos
                    : new Set([...combinedShowIds].filter(id => showIdsWithPhotos.has(id)));
            }
            if (hasPoster === 'true') {
                combinedShowIds = combinedShowIds === null ? showIdsWithPosters
                    : new Set([...combinedShowIds].filter(id => showIdsWithPosters.has(id)));
            }

            contentFilteredShowIds = Array.from(combinedShowIds || []);
            if (contentFilteredShowIds.length === 0) return res.json({ count: 0, shows: [] });
        }

        let query = supabase
            .from('shows')
            .select(`*, venues (id, name, city, state_country, address)`)
            .order('show_date', { ascending: false });

        if (contentFilteredShowIds !== null) query = query.in('id', contentFilteredShowIds);

        if (year && !month) {
            query = query.gte('show_date', `${year}-01-01`).lte('show_date', `${year}-12-31`);
        } else if (month && year) {
            const lastDay = new Date(year, month, 0).getDate();
            query = query
                .gte('show_date', `${year}-${month.padStart(2, '0')}-01`)
                .lte('show_date', `${year}-${month.padStart(2, '0')}-${lastDay}`);
        }

        if (day && month && year) {
            query = query.eq('show_date', `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        }

        if (hasImages === 'true') query = query.eq('has_images', true);
        if (source) query = query.contains('source_types', [source]);

        const { data: shows, error } = await query;
        if (error) return res.status(500).json({ error: 'Failed to search shows' });

        let filteredShows = shows;

        if (month && !year && filteredShows) {
            filteredShows = filteredShows.filter(show => {
                const showMonth = new Date(show.show_date).getMonth() + 1;
                return showMonth === parseInt(month);
            });
        }

        if (venue && filteredShows) {
            filteredShows = filteredShows.filter(show => show.venues?.name === venue);
        }
        if (city && filteredShows) {
            filteredShows = filteredShows.filter(show => show.venues?.city === city);
        }
        if (state && filteredShows) {
            filteredShows = filteredShows.filter(show =>
                show.venues?.state_country.toLowerCase().includes(state.toLowerCase())
            );
        }

        if (song) {
            const { data: songData, error: songLookupError } = await supabase
                .from('songs').select('id').eq('title', song).single();

            if (songLookupError || !songData) return res.json({ count: 0, shows: [] });

            let allSetlistSongs = [];
            let rangeStart = 0;
            let hasMore = true;

            while (hasMore) {
                const { data: pageData, error: songError, count } = await supabase
                    .from('setlist_songs')
                    .select('show_id', { count: 'exact' })
                    .eq('song_id', songData.id)
                    .range(rangeStart, rangeStart + 999);

                if (songError) return res.status(500).json({ error: 'Failed to search by song' });
                if (pageData && pageData.length > 0) {
                    allSetlistSongs = allSetlistSongs.concat(pageData);
                    rangeStart += 1000;
                    if (pageData.length < 1000 || allSetlistSongs.length >= count) hasMore = false;
                } else {
                    hasMore = false;
                }
            }

            const showIdsWithSong = new Set(allSetlistSongs.map(s => s.show_id));
            filteredShows = filteredShows.filter(show => showIdsWithSong.has(show.id));
        }

        res.json({ count: filteredShows.length, shows: filteredShows });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
