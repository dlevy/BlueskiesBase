// One-time backfill: fetch the real YouTube upload date for every existing
// show link (new/edited links get one on save — see server/utils/youtube.js).
//
//   node scripts/backfill_youtube_upload_dates.js           # dry run, prints table
//   node scripts/backfill_youtube_upload_dates.js --write   # saves via update_show_links
require('dotenv').config();
const { supabaseAdmin } = require('../server/config/supabase');
const { getYouTubeId, withYouTubeUploadDates } = require('../server/utils/youtube');

const WRITE = process.argv.includes('--write');

(async () => {
    const { data: shows, error } = await supabaseAdmin
        .from('shows')
        .select('id, show_date, links')
        .not('links', 'is', null)
        .order('show_date');
    if (error) throw error;

    let found = 0, missing = 0, updated = 0;
    for (const show of shows) {
        const links = show.links || [];
        if (!links.some(l => getYouTubeId(l?.url))) continue;

        const next = await withYouTubeUploadDates(links);
        next.forEach(l => {
            const ytId = getYouTubeId(l.url);
            if (!ytId) return;
            l.upload_date ? found++ : missing++;
            console.log(`${show.show_date}  ${ytId.padEnd(12)}  ${l.upload_date || 'NOT FOUND (left out of schema)'}`);
        });

        if (JSON.stringify(next) === JSON.stringify(links)) continue;
        updated++;
        if (WRITE) {
            const { error: rpcError } = await supabaseAdmin.rpc('update_show_links', { p_show_id: show.id, p_links: next });
            if (rpcError) throw rpcError;
        }
    }

    console.log(`\n${found} dates found, ${missing} not found; ${updated} show(s) ${WRITE ? 'updated' : 'would be updated (dry run — pass --write to save)'}`);
})().catch(err => { console.error(err); process.exit(1); });
