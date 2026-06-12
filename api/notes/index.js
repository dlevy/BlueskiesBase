const { supabaseAdmin } = require('../_lib/supabase');
const { authenticate } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await authenticate(req, res);
    if (!user) return;

    try {
        const { show_id, note_text } = req.body;
        if (!show_id || !note_text) return res.status(400).json({ error: 'show_id and note_text are required' });

        const { data: existingNote } = await supabaseAdmin
            .from('user_notes').select('id').eq('show_id', show_id).eq('user_id', user.id).maybeSingle();

        let result;
        if (existingNote) {
            result = await supabaseAdmin
                .from('user_notes')
                .update({ note_text, updated_at: new Date().toISOString() })
                .eq('id', existingNote.id)
                .select()
                .single();
        } else {
            result = await supabaseAdmin
                .from('user_notes')
                .insert({ user_id: user.id, show_id, note_text })
                .select()
                .single();
        }

        if (result.error) return res.status(500).json({ error: 'Failed to save note' });

        res.json({ note: result.data });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
