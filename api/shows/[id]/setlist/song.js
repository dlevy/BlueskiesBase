const { supabase } = require('../../../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { id } = req.query;
    const { song_id, set_number, song_order, is_encore, notes, jams_into, performance_type } = req.body;

    try {
        if (!song_id) return res.status(400).json({ error: 'song_id is required' });
        if (typeof set_number !== 'number') return res.status(400).json({ error: 'set_number must be a number' });
        if (typeof song_order !== 'number') return res.status(400).json({ error: 'song_order must be a number' });

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(song_id)) return res.status(400).json({ error: 'song_id must be a valid UUID' });

        const jamsIntoValue = jams_into || null;
        if (jamsIntoValue !== null && !uuidRegex.test(jamsIntoValue)) {
            return res.status(400).json({ error: 'jams_into must be a valid UUID or null' });
        }

        const performanceTypeValue = performance_type || 'full';
        if (!['full', 'tease', 'partial'].includes(performanceTypeValue)) {
            return res.status(400).json({ error: 'performance_type must be one of: full, tease, partial' });
        }

        const songIdsToCheck = [song_id];
        if (jamsIntoValue) songIdsToCheck.push(jamsIntoValue);

        const { data: existingSongs, error: songCheckError } = await supabase
            .from('songs').select('id').in('id', songIdsToCheck);

        if (songCheckError) return res.status(500).json({ error: 'Failed to validate song references' });

        const existingSongIds = new Set(existingSongs.map(s => s.id));
        const missingSongIds = songIdsToCheck.filter(sid => !existingSongIds.has(sid));
        if (missingSongIds.length > 0) return res.status(400).json({ error: 'Invalid song references', missingSongIds });

        const { data: show, error: showCheckError } = await supabase
            .from('shows').select('id').eq('id', id).single();

        if (showCheckError || !show) return res.status(404).json({ error: 'Show not found' });

        const { data: setlistSong, error } = await supabase
            .from('setlist_songs')
            .insert([{
                show_id: id,
                song_id,
                set_number,
                song_order,
                is_encore: is_encore || false,
                notes: notes || null,
                jams_into: jamsIntoValue,
                performance_type: performanceTypeValue
            }])
            .select()
            .single();

        if (error) return res.status(500).json({ error: 'Failed to add song to setlist', details: error.message });

        res.status(201).json(setlistSong);
    } catch (e) {
        res.status(500).json({ error: 'Internal server error', message: e.message });
    }
};
