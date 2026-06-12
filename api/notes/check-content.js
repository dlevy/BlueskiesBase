const { supabaseAdmin } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { show_ids } = req.body;
        if (!show_ids || !Array.isArray(show_ids) || show_ids.length === 0) {
            return res.json({ contentMap: {} });
        }

        const BATCH_SIZE = 100;
        let allNotesData = [];
        let allPhotosData = [];
        let allPostersData = [];

        for (let i = 0; i < show_ids.length; i += BATCH_SIZE) {
            const batch = show_ids.slice(i, i + BATCH_SIZE);

            const [notesResult, photosResult, postersResult] = await Promise.all([
                supabaseAdmin.from('user_notes').select('show_id').in('show_id', batch),
                supabaseAdmin.from('user_photos').select('show_id').in('show_id', batch),
                supabaseAdmin.from('user_posters').select('show_id').in('show_id', batch)
            ]);

            if (notesResult.data) allNotesData = allNotesData.concat(notesResult.data);
            if (photosResult.data) allPhotosData = allPhotosData.concat(photosResult.data);
            if (postersResult.data) allPostersData = allPostersData.concat(postersResult.data);
        }

        const contentMap = {};
        show_ids.forEach(showId => {
            contentMap[showId] = {
                hasNotes: allNotesData.some(n => n.show_id === showId),
                hasPhotos: allPhotosData.some(p => p.show_id === showId),
                hasPoster: allPostersData.some(p => p.show_id === showId)
            };
        });

        res.json({ contentMap });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
