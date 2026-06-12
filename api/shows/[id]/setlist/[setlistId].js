const { supabase } = require('../../../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

    const { setlistId } = req.query;

    try {
        const { error } = await supabase.from('setlist_songs').delete().eq('id', setlistId);

        if (error) return res.status(500).json({ error: 'Failed to remove song from setlist' });

        res.json({ message: 'Song removed from setlist successfully' });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
