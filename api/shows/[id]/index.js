const { supabase } = require('../../_lib/supabase');

module.exports = async function handler(req, res) {
    const { id } = req.query;

    if (req.method === 'GET') {
        try {
            const { data: show, error: showError } = await supabase
                .from('shows')
                .select(`*, venues (id, name, city, state_country, address)`)
                .eq('id', id)
                .single();

            if (showError) return res.status(404).json({ error: 'Show not found' });

            const { data: setlist, error: setlistError } = await supabase
                .from('setlist_songs')
                .select(`
                    id, show_id, song_id, set_number, song_order, notes, is_encore, jams_into, performance_type,
                    songs!setlist_songs_song_id_fkey (id, title, original_artist, is_original, written_by)
                `)
                .eq('show_id', id)
                .order('set_number')
                .order('song_order');

            if (setlistError) {
                return res.json({ ...show, setlist: {}, setlist_error: setlistError.message });
            }

            const sets = {};
            setlist.forEach(item => {
                const setNum = item.is_encore ? 'encore' : `set${item.set_number}`;
                if (!sets[setNum]) sets[setNum] = [];
                sets[setNum].push({
                    id: item.id,
                    song_id: item.song_id,
                    order: item.song_order,
                    notes: item.notes,
                    jams_into: item.jams_into || null,
                    performance_type: item.performance_type || 'full',
                    title: item.songs?.title,
                    is_original: item.songs?.is_original,
                    original_artist: item.songs?.original_artist,
                    written_by: item.songs?.written_by,
                    songs: item.songs
                });
            });

            res.json({ ...show, setlist: sets });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'PUT') {
        try {
            const { venue_id, show_date, artist_name, tour_name, notes, has_images, source_types } = req.body;

            const { data: show, error } = await supabase
                .from('shows')
                .update({ venue_id, show_date, artist_name, tour_name, notes, has_images, source_types })
                .eq('id', id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: 'Failed to update show' });

            res.json(show);
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'DELETE') {
        try {
            const { error } = await supabase.from('shows').delete().eq('id', id);

            if (error) return res.status(500).json({ error: 'Failed to delete show' });

            res.json({ message: 'Show deleted successfully' });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
