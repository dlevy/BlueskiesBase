const { supabase } = require('../../_lib/supabase');

module.exports = async function handler(req, res) {
    const { id } = req.query;

    if (req.method === 'GET') {
        try {
            const { data: song, error: songError } = await supabase
                .from('songs').select('*').eq('id', id).single();

            if (songError) return res.status(404).json({ error: 'Song not found' });

            let allPerformances = [];
            let rangeStart = 0;
            const PAGE_SIZE = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data: pageData, error: perfError, count } = await supabase
                    .from('setlist_songs')
                    .select(`*, shows (id, show_date, artist_name, venues (name, city, state_country))`, { count: 'exact' })
                    .eq('song_id', id)
                    .order('shows(show_date)', { ascending: false })
                    .range(rangeStart, rangeStart + PAGE_SIZE - 1);

                if (perfError) return res.status(500).json({ error: 'Failed to fetch performances' });
                if (pageData && pageData.length > 0) {
                    allPerformances = allPerformances.concat(pageData);
                    rangeStart += PAGE_SIZE;
                    if (pageData.length < PAGE_SIZE || allPerformances.length >= count) hasMore = false;
                } else {
                    hasMore = false;
                }
            }

            const performanceTypeCounts = { full: 0, tease: 0, partial: 0 };
            allPerformances.forEach(perf => {
                const perfType = perf.performance_type || 'full';
                if (performanceTypeCounts.hasOwnProperty(perfType)) performanceTypeCounts[perfType]++;
            });

            res.json({
                ...song,
                performances: allPerformances,
                performance_type_counts: performanceTypeCounts,
                total_performances: allPerformances.length
            });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'PUT') {
        try {
            const { title, original_artist, is_original, written_by, lyrics, notes, album_id } = req.body;

            const { data: song, error } = await supabase
                .from('songs')
                .update({ title, original_artist, is_original, written_by, lyrics, notes, album_id, updated_at: new Date() })
                .eq('id', id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: 'Failed to update song' });

            res.json(song);
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'DELETE') {
        try {
            const { data: usages, error: usageError } = await supabase
                .from('setlist_songs').select('id, show_id').eq('song_id', id);

            if (usageError) return res.status(500).json({ error: 'Failed to check song usage' });

            if (usages && usages.length > 0) {
                return res.status(400).json({
                    error: 'Cannot delete song that is used in setlists',
                    message: `This song appears in ${usages.length} setlist(s) and cannot be deleted.`,
                    usageCount: usages.length
                });
            }

            const { error } = await supabase.from('songs').delete().eq('id', id);

            if (error) {
                if (error.code === '23503') {
                    return res.status(400).json({ error: 'Cannot delete song', message: 'Song is still referenced in setlists.' });
                }
                return res.status(500).json({ error: 'Failed to delete song' });
            }

            res.json({ message: 'Song deleted successfully' });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
