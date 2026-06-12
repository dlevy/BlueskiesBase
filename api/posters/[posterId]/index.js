const { supabaseAdmin } = require('../../_lib/supabase');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
    const { posterId } = req.query;

    const user = await authenticate(req, res);
    if (!user) return;

    const { data: profile } = await supabaseAdmin
        .from('profiles').select('is_admin').eq('id', user.id).single();
    const isAdmin = profile?.is_admin || false;

    if (req.method === 'PUT') {
        try {
            const { caption } = req.body;

            const { data: poster } = await supabaseAdmin
                .from('user_posters').select('user_id').eq('id', posterId).single();

            if (!poster) return res.status(404).json({ error: 'Poster not found' });
            if (poster.user_id !== user.id && !isAdmin) return res.status(403).json({ error: 'Not authorized' });

            const { data: updatedPoster, error } = await supabaseAdmin
                .from('user_posters')
                .update({ caption })
                .eq('id', posterId)
                .select(`*, profiles:user_id (id, username)`)
                .single();

            if (error) return res.status(500).json({ error: 'Failed to update poster' });

            res.json({ poster: updatedPoster });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'DELETE') {
        try {
            const { data: poster } = await supabaseAdmin
                .from('user_posters').select('user_id, poster_url').eq('id', posterId).single();

            if (!poster) return res.status(404).json({ error: 'Poster not found' });
            if (poster.user_id !== user.id && !isAdmin) return res.status(403).json({ error: 'Not authorized' });

            const { error: dbError } = await supabaseAdmin.from('user_posters').delete().eq('id', posterId);
            if (dbError) return res.status(500).json({ error: 'Failed to delete poster' });

            const fileName = poster.poster_url.split('/show-posters/')[1];
            if (fileName) await supabaseAdmin.storage.from('show-posters').remove([fileName]);

            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
