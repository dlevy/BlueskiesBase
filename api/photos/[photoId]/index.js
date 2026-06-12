const { supabaseAdmin } = require('../../_lib/supabase');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
    const { photoId } = req.query;

    const user = await authenticate(req, res);
    if (!user) return;

    const { data: profile } = await supabaseAdmin
        .from('profiles').select('is_admin').eq('id', user.id).single();
    const isAdmin = profile?.is_admin || false;

    if (req.method === 'PUT') {
        try {
            const { caption } = req.body;

            const { data: photo, error: fetchError } = await supabaseAdmin
                .from('user_photos').select('user_id').eq('id', photoId).single();

            if (fetchError || !photo) return res.status(404).json({ error: 'Photo not found' });
            if (photo.user_id !== user.id && !isAdmin) return res.status(403).json({ error: 'Not authorized' });

            const { data: updatedPhoto, error } = await supabaseAdmin
                .from('user_photos')
                .update({ caption, updated_at: new Date().toISOString() })
                .eq('id', photoId)
                .select(`*, profiles:user_id (id, username)`)
                .single();

            if (error) return res.status(500).json({ error: 'Failed to update photo' });

            res.json({ photo: updatedPhoto });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else if (req.method === 'DELETE') {
        try {
            const { data: photo, error: fetchError } = await supabaseAdmin
                .from('user_photos').select('user_id, photo_url').eq('id', photoId).single();

            if (fetchError || !photo) return res.status(404).json({ error: 'Photo not found' });
            if (photo.user_id !== user.id && !isAdmin) return res.status(403).json({ error: 'Not authorized' });

            const { error: deleteError } = await supabaseAdmin.from('user_photos').delete().eq('id', photoId);
            if (deleteError) return res.status(500).json({ error: 'Failed to delete photo' });

            const urlParts = photo.photo_url.split('/show-photos/');
            if (urlParts.length > 1) {
                await supabaseAdmin.storage.from('show-photos').remove([urlParts[1]]);
            }

            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }

    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
