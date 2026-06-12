const { supabase } = require('../_lib/supabase');
const { authenticate } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await authenticate(req, res);
    if (!user) return;

    try {
        const { showIds } = req.body;
        if (!showIds || !Array.isArray(showIds) || showIds.length === 0) {
            return res.status(400).json({ error: 'showIds array is required' });
        }

        const BATCH_SIZE = 100;
        let allUserShows = [];

        if (showIds.length > BATCH_SIZE) {
            for (let i = 0; i < showIds.length; i += BATCH_SIZE) {
                const batch = showIds.slice(i, i + BATCH_SIZE);
                const { data: batchData, error } = await supabase
                    .from('user_shows').select('show_id').eq('user_id', user.id).in('show_id', batch);

                if (error) return res.status(500).json({ error: 'Failed to check attendance' });
                allUserShows = allUserShows.concat(batchData || []);
            }
        } else {
            const { data: userShows, error } = await supabase
                .from('user_shows').select('show_id').eq('user_id', user.id).in('show_id', showIds);

            if (error) return res.status(500).json({ error: 'Failed to check attendance' });
            allUserShows = userShows || [];
        }

        const attendanceMap = {};
        showIds.forEach(showId => { attendanceMap[showId] = false; });
        allUserShows.forEach(us => { attendanceMap[us.show_id] = true; });

        res.json({ attendance: attendanceMap });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
