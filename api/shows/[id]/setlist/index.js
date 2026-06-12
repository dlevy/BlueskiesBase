const { supabase } = require('../../../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

    const { id } = req.query;
    const { setlist } = req.body;

    try {
        if (!setlist || setlist.length === 0) {
            const { error: deleteError } = await supabase
                .from('setlist_songs').delete().eq('show_id', id);

            if (deleteError) return res.status(500).json({ error: 'Failed to clear setlist', details: deleteError.message });
            return res.json({ message: 'Setlist cleared successfully', setlist: [] });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        const setlistEntries = setlist.map((item, index) => {
            if (!item.song_id) throw new Error(`Entry ${index + 1}: song_id is required`);
            if (typeof item.set_number !== 'number') throw new Error(`Entry ${index + 1}: set_number must be a number`);
            if (typeof item.song_order !== 'number') throw new Error(`Entry ${index + 1}: song_order must be a number`);
            if (!uuidRegex.test(item.song_id)) throw new Error(`Entry ${index + 1}: song_id is not a valid UUID`);

            const jamsInto = item.jams_into || null;
            if (jamsInto !== null && !uuidRegex.test(jamsInto)) throw new Error(`Entry ${index + 1}: jams_into must be a valid UUID or null`);

            const performanceType = item.performance_type || 'full';
            if (!['full', 'tease', 'partial'].includes(performanceType)) throw new Error(`Entry ${index + 1}: invalid performance_type`);

            return {
                show_id: id,
                song_id: item.song_id,
                set_number: item.set_number,
                song_order: item.song_order,
                is_encore: item.is_encore || false,
                notes: item.notes || null,
                jams_into: jamsInto,
                performance_type: performanceType
            };
        });

        const allSongIds = new Set();
        setlistEntries.forEach(e => {
            allSongIds.add(e.song_id);
            if (e.jams_into) allSongIds.add(e.jams_into);
        });

        const { data: existingSongs, error: songCheckError } = await supabase
            .from('songs').select('id').in('id', Array.from(allSongIds));

        if (songCheckError) return res.status(500).json({ error: 'Failed to validate song references' });

        const existingSongIds = new Set(existingSongs.map(s => s.id));
        const missingSongIds = Array.from(allSongIds).filter(sid => !existingSongIds.has(sid));
        if (missingSongIds.length > 0) return res.status(400).json({ error: 'Invalid song references', missingSongIds });

        const { data: show, error: showCheckError } = await supabase
            .from('shows').select('id').eq('id', id).single();

        if (showCheckError || !show) return res.status(404).json({ error: 'Show not found' });

        const { error: deleteError } = await supabase.from('setlist_songs').delete().eq('show_id', id);
        if (deleteError) return res.status(500).json({ error: 'Failed to update setlist', details: deleteError.message });

        const { data: newSetlist, error: insertError } = await supabase
            .from('setlist_songs').insert(setlistEntries).select();

        if (insertError) return res.status(500).json({ error: 'Failed to insert setlist', message: insertError.message });

        res.json({ message: 'Setlist updated successfully', setlist: newSetlist });
    } catch (e) {
        if (e.message.includes('Entry')) return res.status(400).json({ error: e.message });
        res.status(500).json({ error: 'Internal server error', message: e.message });
    }
};
