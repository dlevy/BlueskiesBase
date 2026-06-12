const { supabaseAdmin } = require('../../_lib/supabase');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

    const { noteId } = req.query;

    const user = await authenticate(req, res);
    if (!user) return;

    try {
        const { data: profile } = await supabaseAdmin
            .from('profiles').select('is_admin').eq('id', user.id).single();
        const isAdmin = profile?.is_admin || false;

        const { data: note, error: fetchError } = await supabaseAdmin
            .from('user_notes').select('user_id').eq('id', noteId).single();

        if (fetchError || !note) return res.status(404).json({ error: 'Note not found' });
        if (note.user_id !== user.id && !isAdmin) return res.status(403).json({ error: 'Not authorized' });

        const { error: deleteError } = await supabaseAdmin.from('user_notes').delete().eq('id', noteId);

        if (deleteError) return res.status(500).json({ error: 'Failed to delete note' });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
