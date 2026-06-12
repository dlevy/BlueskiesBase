const { supabase } = require('../../_lib/supabase');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
    const { showId } = req.query;

    const user = await authenticate(req, res);
    if (!user) return;

    if (req.method === 'POST') {
        try {
            const { data, error } = await supabase
                .from('user_shows')
                .insert([{ user_id: user.id, show_id: showId }])
                .select()
                .single();

            if (error) {
                if (error.code === '23505') return res.status(400).json({ error: 'Show already marked as attended' });
                return res.status(500).json({ error: 'Failed to mark show as attended' });
            }

            res.status(201).json(data);
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'DELETE') {
        try {
            const { error } = await supabase
                .from('user_shows')
                .delete()
                .eq('user_id', user.id)
                .eq('show_id', showId);

            if (error) return res.status(500).json({ error: 'Failed to unmark show' });

            res.json({ message: 'Show unmarked successfully' });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
