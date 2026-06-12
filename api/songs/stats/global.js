const { supabase } = require('../../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        let allSetlistSongs = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: batch, error: batchError } = await supabase
                .from('setlist_songs')
                .select(`
                    show_id, song_id, performance_type,
                    songs!setlist_songs_song_id_fkey (id, title, is_original, original_artist, album_id)
                `)
                .range(from, from + batchSize - 1);

            if (batchError) return res.status(500).json({ error: 'Failed to fetch song statistics' });
            if (batch && batch.length > 0) {
                allSetlistSongs = allSetlistSongs.concat(batch);
                from += batchSize;
                hasMore = batch.length === batchSize;
            } else {
                hasMore = false;
            }
        }

        const { data: shows, error: showsError } = await supabase
            .from('shows').select('id, show_date').range(0, 999);

        if (showsError) return res.status(500).json({ error: 'Failed to fetch show dates' });

        const showDates = {};
        shows.forEach(show => { showDates[show.id] = show.show_date; });

        const songPlayCounts = {};
        allSetlistSongs.forEach(ss => {
            if (!ss.songs) return;
            const songId = ss.songs.id;
            const showDate = showDates[ss.show_id];
            if (!showDate) return;

            if (!songPlayCounts[songId]) {
                songPlayCounts[songId] = {
                    id: songId, title: ss.songs.title,
                    is_original: ss.songs.is_original, original_artist: ss.songs.original_artist,
                    shows: new Set(), lastPlayed: showDate
                };
            }
            songPlayCounts[songId].shows.add(ss.show_id);
            if (new Date(showDate) > new Date(songPlayCounts[songId].lastPlayed)) {
                songPlayCounts[songId].lastPlayed = showDate;
            }
        });

        const songsWithCounts = Object.values(songPlayCounts).map(song => ({
            id: song.id, title: song.title, is_original: song.is_original,
            original_artist: song.original_artist, playCount: song.shows.size, lastPlayed: song.lastPlayed
        }));

        const covers = songsWithCounts.filter(s => s.is_original === false).sort((a, b) => b.playCount - a.playCount);
        const originals = songsWithCounts.filter(s => s.is_original === true).sort((a, b) => b.playCount - a.playCount);

        res.json({
            covers: { total: covers.length, top5: covers.slice(0, 5), rarest5: covers.slice(-5).reverse() },
            originals: { total: originals.length, top5: originals.slice(0, 5), rarest5: originals.slice(-5).reverse() }
        });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
