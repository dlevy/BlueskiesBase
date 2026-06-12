const multer = require('multer');
const { supabaseAdmin } = require('../_lib/supabase');
const { authenticate } = require('../_lib/auth');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }, // 4MB (Vercel payload limit is 4.5MB)
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

const runMiddleware = (req, res, fn) =>
    new Promise((resolve, reject) => {
        fn(req, res, result => (result instanceof Error ? reject(result) : resolve(result)));
    });

module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await authenticate(req, res);
    if (!user) return;

    try {
        await runMiddleware(req, res, upload.single('poster'));
    } catch (e) {
        return res.status(400).json({ error: e.message });
    }

    try {
        const { show_id, caption } = req.body;
        const file = req.file;

        if (!show_id) return res.status(400).json({ error: 'show_id is required' });
        if (!file) return res.status(400).json({ error: 'No poster file provided' });

        const { data: existingPoster } = await supabaseAdmin
            .from('user_posters').select('id, poster_url, user_id').eq('show_id', show_id).single();

        if (existingPoster && existingPoster.user_id !== user.id) {
            const { data: profile } = await supabaseAdmin
                .from('profiles').select('is_admin').eq('id', user.id).single();
            if (!profile?.is_admin) {
                return res.status(403).json({ error: 'A poster already exists. Only admins can replace it.' });
            }
        }

        const fileExt = file.originalname.split('.').pop();
        const fileName = `${user.id}/${show_id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('show-posters')
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

        if (uploadError) return res.status(500).json({ error: 'Failed to upload poster' });

        const { data: { publicUrl } } = supabaseAdmin.storage.from('show-posters').getPublicUrl(fileName);

        if (existingPoster) {
            const oldFileName = existingPoster.poster_url.split('/show-posters/')[1];
            if (oldFileName) await supabaseAdmin.storage.from('show-posters').remove([oldFileName]);

            const { data: poster, error: dbError } = await supabaseAdmin
                .from('user_posters')
                .update({ user_id: user.id, poster_url: publicUrl, caption: caption || null, updated_at: new Date().toISOString() })
                .eq('id', existingPoster.id)
                .select(`*, profiles:user_id (id, username)`)
                .single();

            if (dbError) {
                await supabaseAdmin.storage.from('show-posters').remove([fileName]);
                return res.status(500).json({ error: 'Failed to update poster record' });
            }

            return res.json({ poster });
        }

        const { data: poster, error: dbError } = await supabaseAdmin
            .from('user_posters')
            .insert({ user_id: user.id, show_id, poster_url: publicUrl, caption: caption || null })
            .select(`*, profiles:user_id (id, username)`)
            .single();

        if (dbError) {
            await supabaseAdmin.storage.from('show-posters').remove([fileName]);
            return res.status(500).json({ error: 'Failed to save poster record' });
        }

        res.json({ poster });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
