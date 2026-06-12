const { supabase } = require('../_lib/supabase');
const { authenticate } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const user = await authenticate(req, res);
    if (!user) return;

    try {
        const { data: attendedShows, error: showsError } = await supabase
            .from('user_shows')
            .select(`show_id, shows (id, show_date, artist_name, tour_name, venues (name, city, state_country))`)
            .eq('user_id', user.id);

        if (showsError) return res.status(500).json({ error: 'Failed to fetch statistics' });

        const attendedShowIds = attendedShows.map(us => us.show_id);
        let songsSeen = [];

        if (attendedShowIds.length > 0) {
            let allSetlistSongs = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data: setlistSongs, error: songsError } = await supabase
                    .from('setlist_songs')
                    .select(`song_id, show_id, performance_type, songs!setlist_songs_song_id_fkey (id, title, is_original, original_artist)`)
                    .in('show_id', attendedShowIds)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (songsError) break;
                if (setlistSongs && setlistSongs.length > 0) {
                    allSetlistSongs = allSetlistSongs.concat(setlistSongs);
                    page++;
                    hasMore = setlistSongs.length === pageSize;
                } else {
                    hasMore = false;
                }
            }

            const songPlayCount = new Map();
            allSetlistSongs.forEach(ss => {
                if (ss.songs) {
                    if (!songPlayCount.has(ss.song_id)) {
                        songPlayCount.set(ss.song_id, { ...ss.songs, playCount: 1, showIds: new Set([ss.show_id]) });
                    } else {
                        const existing = songPlayCount.get(ss.song_id);
                        if (!existing.showIds.has(ss.show_id)) {
                            existing.playCount++;
                            existing.showIds.add(ss.show_id);
                        }
                    }
                }
            });

            songsSeen = Array.from(songPlayCount.values()).map(({ showIds, ...songData }) => songData);
        }

        let allPlayedSongsData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: playedSongsData, error: playedSongsError } = await supabase
                .from('setlist_songs')
                .select(`song_id, songs!setlist_songs_song_id_fkey!inner (id, title, is_original, original_artist)`)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (playedSongsError) return res.status(500).json({ error: 'Failed to fetch statistics' });
            if (playedSongsData && playedSongsData.length > 0) {
                allPlayedSongsData = allPlayedSongsData.concat(playedSongsData);
                page++;
                hasMore = playedSongsData.length === pageSize;
            } else {
                hasMore = false;
            }
        }

        const uniquePlayedSongs = new Map();
        allPlayedSongsData.forEach(ps => {
            if (ps.songs && !uniquePlayedSongs.has(ps.song_id)) uniquePlayedSongs.set(ps.song_id, ps.songs);
        });
        const allPlayedSongs = Array.from(uniquePlayedSongs.values()).sort((a, b) => a.title.localeCompare(b.title));

        const seenSongIds = new Set(songsSeen.map(s => s.id));
        const songsNotSeenBasic = allPlayedSongs.filter(song => !seenSongIds.has(song.id));

        let songsNotSeenWithShow = [];
        if (songsNotSeenBasic.length > 0) {
            const notSeenSongIds = songsNotSeenBasic.map(s => s.id);
            let allNotSeenSetlistData = [];
            let rangeStart = 0;
            hasMore = true;

            while (hasMore) {
                const { data: pageData, error: notSeenError, count } = await supabase
                    .from('setlist_songs')
                    .select(`song_id, show_id, shows!inner (id, show_date, artist_name, venues (name, city, state_country))`, { count: 'exact' })
                    .in('song_id', notSeenSongIds)
                    .order('shows(show_date)', { ascending: false })
                    .range(rangeStart, rangeStart + 999);

                if (notSeenError) break;
                if (pageData && pageData.length > 0) {
                    allNotSeenSetlistData = allNotSeenSetlistData.concat(pageData);
                    rangeStart += 1000;
                    if (pageData.length < 1000 || allNotSeenSetlistData.length >= count) hasMore = false;
                } else {
                    hasMore = false;
                }
            }

            const songToMostRecentShow = new Map();
            allNotSeenSetlistData.forEach(item => {
                if (!songToMostRecentShow.has(item.song_id)) songToMostRecentShow.set(item.song_id, item.shows);
            });

            songsNotSeenWithShow = songsNotSeenBasic.map(song => ({
                ...song, mostRecentShow: songToMostRecentShow.get(song.id) || null
            }));
        }

        res.json({
            totalShowsAttended: attendedShows.length,
            attendedShows: attendedShows.map(us => us.shows),
            songsSeen,
            songsNotSeen: songsNotSeenWithShow,
            totalSongsSeen: songsSeen.length,
            totalSongsNotSeen: songsNotSeenWithShow.length
        });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error', message: e.message });
    }
};
