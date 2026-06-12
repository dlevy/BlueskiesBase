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
        await runMiddleware(req, res, upload.single('photo'));
    } catch (e) {
        return res.status(400).json({ error: e.message });
    }

    try {
        const { show_id, caption } = req.body;
        const file = req.file;

        if (!show_id) return res.status(400).json({ error: 'show_id is required' });
        if (!file) return res.status(400).json({ error: 'No photo file provided' });

        const fileExt = file.originalname.split('.').pop();
        const fileName = `${user.id}/${show_id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('show-photos')
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

        if (uploadError) return res.status(500).json({ error: 'Failed to upload photo' });

        const { data: { publicUrl } } = supabaseAdmin.storage.from('show-photos').getPublicUrl(fileName);

        const { data: existingPhotos } = await supabaseAdmin
            .from('user_photos').select('display_order').eq('show_id', show_id)
            .order('display_order', { ascending: false }).limit(1);

        const nextOrder = existingPhotos && existingPhotos.length > 0 ? existingPhotos[0].display_order + 1 : 0;

        const { data: photo, error: dbError } = await supabaseAdmin
            .from('user_photos')
            .insert({ user_id: user.id, show_id, photo_url: publicUrl, caption: caption || null, display_order: nextOrder })
            .select(`*, profiles:user_id (id, username)`)
            .single();

        if (dbError) {
            await supabaseAdmin.storage.from('show-photos').remove([fileName]);
            return res.status(500).json({ error: 'Failed to save photo record' });
        }

        res.json({ photo });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
