/**
 * Sync missing setlists from setlist.fm
 *
 * Finds every show in the database with 0 setlist songs and attempts to
 * populate it from the setlist.fm API, creating any new songs as needed.
 *
 * Usage:
 *   node scripts/sync-setlists.js
 *   node scripts/sync-setlists.js --dry-run     (show what would be imported, no writes)
 *   node scripts/sync-setlists.js --date 2025-09-17  (single date only)
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const SETLIST_FM_KEY = process.env.SETLIST_FM_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SETLIST_FM_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars: SETLIST_FM_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const sfm = axios.create({
    baseURL: 'https://api.setlist.fm/rest/1.0',
    headers: { 'x-api-key': SETLIST_FM_KEY, 'Accept': 'application/json' }
});

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_DATE = (() => {
    const i = process.argv.indexOf('--date');
    return i !== -1 ? process.argv[i + 1] : null;
})();

// setlist.fm uses dd-MM-yyyy; our DB uses yyyy-MM-dd
function toSfmDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
}

// All shows catalogued under Sturgill Simpson on setlist.fm, including JBS-era shows.
// JBS profile (0fe84427-...) exists but is mostly empty — always try Sturgill first.
const ARTIST_MBIDS = [
    'f6e61750-a6b7-4d88-979b-052345cd0e4a', // Sturgill Simpson (primary — has all tours)
    '0fe84427-7a92-4eae-9230-7ae144da8e65'  // Johnny Blue Skies (fallback)
];

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function sfmRequest(endpoint, params, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const { data } = await sfm.get(endpoint, { params });
            return data;
        } catch (err) {
            if (err.response?.status === 429) {
                const delay = 6000 * (attempt + 1);
                process.stdout.write(`(rate limited, waiting ${delay / 1000}s) `);
                await sleep(delay);
                continue;
            }
            if (err.response?.status === 404) return null;
            throw err;
        }
    }
    throw new Error('Exceeded retry limit after rate limiting');
}

async function fetchSetlistForDate(isoDate) {
    await sleep(1200); // ~0.8 req/sec — within free tier limit
    const date = toSfmDate(isoDate);

    for (const mbid of ARTIST_MBIDS) {
        const data = await sfmRequest('/search/setlists', { artistMbid: mbid, date });
        if (data?.setlist?.length > 0) return data.setlist[0];
        await sleep(1200);
    }
    return null;
}

async function getOrCreateSong(title, isCover, originalArtist) {
    const { data } = await sb.from('songs').select('id').eq('title', title).limit(1);
    if (data?.length > 0) return data[0].id;

    const { data: created, error } = await sb.from('songs').insert({
        title,
        is_original: !isCover,
        original_artist: isCover ? originalArtist : null
    }).select('id').single();

    if (error) throw new Error(`Failed to create song "${title}": ${error.message}`);
    return created.id;
}

function parseSets(sets) {
    const songs = [];
    let setNumber = 1;

    for (const setData of (sets || [])) {
        const isEncore = !!setData.encore;

        for (let i = 0; i < (setData.song || []).length; i++) {
            const s = setData.song[i];
            if (!s.name) continue;
            songs.push({
                title: s.name,
                isCover: !!s.cover,
                originalArtist: s.cover?.name || null,
                setNumber,
                songOrder: i + 1,
                isEncore,
                notes: s.info || null
            });
        }

        if (!isEncore) setNumber++;
    }

    return songs;
}

async function importSetlist(show, setlistData) {
    const sets = setlistData.sets?.set || [];
    const songs = parseSets(sets);

    if (songs.length === 0) {
        console.log(`  ⚠️  setlist.fm has no songs listed for this show`);
        return 0;
    }

    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would import ${songs.length} songs:`);
        songs.forEach(s => {
            const label = s.isEncore ? 'Enc' : `Set ${s.setNumber}`;
            const cover = s.isCover ? ` (cover: ${s.originalArtist})` : '';
            console.log(`    ${label} #${s.songOrder}: ${s.title}${cover}`);
        });
        return songs.length;
    }

    const entries = [];
    for (const song of songs) {
        const songId = await getOrCreateSong(song.title, song.isCover, song.originalArtist);
        entries.push({
            show_id: show.id,
            song_id: songId,
            set_number: song.setNumber,
            song_order: song.songOrder,
            is_encore: song.isEncore,
            notes: song.notes,
            jams_into: null,
            performance_type: 'full'
        });
    }

    const { error } = await sb.from('setlist_songs').insert(entries);
    if (error) throw new Error(`DB insert failed: ${error.message}`);

    return entries.length;
}

async function main() {
    console.log('='.repeat(50));
    console.log('BlueskiesBase — Setlist Sync');
    if (DRY_RUN) console.log('DRY RUN MODE — no changes will be written');
    if (SINGLE_DATE) console.log(`Targeting single date: ${SINGLE_DATE}`);
    console.log('='.repeat(50) + '\n');

    // Get shows to check
    let query = sb.from('shows')
        .select('id, show_date, venues(name, city)')
        .order('show_date');
    if (SINGLE_DATE) query = query.eq('show_date', SINGLE_DATE);

    const { data: allShows, error: showsErr } = await query;
    if (showsErr) throw showsErr;

    // Filter to shows with 0 setlist songs
    console.log(`Checking ${allShows.length} show(s) for missing setlist data...`);
    const empty = [];
    for (const show of allShows) {
        const { count } = await sb.from('setlist_songs')
            .select('*', { count: 'exact', head: true })
            .eq('show_id', show.id);
        if (count === 0) empty.push(show);
    }

    if (empty.length === 0) {
        console.log('\n✅ All shows already have setlist data — nothing to do!');
        return;
    }

    console.log(`\nFound ${empty.length} show(s) with no setlist data:`);
    empty.forEach(s => console.log(`  ${s.show_date}  ${s.venues?.name}, ${s.venues?.city}`));

    console.log('\nArtist MBIDs:');
    console.log(`  Sturgill Simpson: ${ARTIST_MBIDS[0]}`);
    console.log(`  Johnny Blue Skies: ${ARTIST_MBIDS[1]}`);

    // Process each empty show
    console.log('\n' + '-'.repeat(50));
    let imported = 0, notFound = 0, errors = 0;

    for (const show of empty) {
        const label = `${show.show_date}  ${show.venues?.name}, ${show.venues?.city}`;
        process.stdout.write(`\n${label}\n  Fetching from setlist.fm... `);

        try {
            const setlist = await fetchSetlistForDate(show.show_date);

            if (!setlist) {
                console.log('not found on setlist.fm');
                notFound++;
                continue;
            }

            const sfmVenue = setlist.venue?.name || '?';
            console.log(`matched: ${sfmVenue}`);

            const count = await importSetlist(show, setlist);
            if (count > 0) {
                console.log(`  ✅ ${DRY_RUN ? 'Would import' : 'Imported'} ${count} songs`);
                imported++;
            }
        } catch (err) {
            console.log(`  ❌ Error: ${err.message}`);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Summary');
    console.log('='.repeat(50));
    console.log(`Shows processed:   ${empty.length}`);
    console.log(`${DRY_RUN ? 'Would import' : 'Imported'}:        ${imported}`);
    console.log(`Not on setlist.fm: ${notFound}`);
    console.log(`Errors:            ${errors}`);
    console.log('='.repeat(50));
}

main().catch(err => {
    console.error('\nFatal:', err.message);
    process.exit(1);
});
