const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const { data: songs, error } = await supabase
                .from('songs').select('*').order('title');

            if (error) return res.status(500).json({ error: 'Failed to fetch songs' });

            const songIds = songs.map(s => s.id);
            let allSetlistSongs = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data: batch, error: batchError } = await supabase
                    .from('setlist_songs')
                    .select('song_id, show_id')
                    .in('song_id', songIds)
                    .range(from, from + batchSize - 1);

                if (batchError) break;
                if (batch && batch.length > 0) {
                    allSetlistSongs = allSetlistSongs.concat(batch);
                    hasMore = batch.length === batchSize;
                    from += batchSize;
                } else {
                    hasMore = false;
                }
            }

            const performanceCounts = {};
            allSetlistSongs.forEach(entry => {
                if (!performanceCounts[entry.song_id]) performanceCounts[entry.song_id] = new Set();
                performanceCounts[entry.song_id].add(entry.show_id);
            });

            const songsWithCounts = songs.map(song => ({
                ...song,
                performance_count: performanceCounts[song.id] ? performanceCounts[song.id].size : 0
            }));

            res.json({ songs: songsWithCounts });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'POST') {
        try {
            const { title, original_artist, is_original, written_by, lyrics, notes, album_id } = req.body;

            const { data: song, error } = await supabase
                .from('songs')
                .insert([{ title, original_artist, is_original, written_by, lyrics, notes, album_id }])
                .select()
                .single();

            if (error) return res.status(500).json({ error: 'Failed to create song' });

            res.status(201).json(song);
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
