/**
 * Sync missing setlists from setlist.fm
 *
 * Finds every show in the database with 0 setlist songs and attempts to
 * populate it from the setlist.fm API, creating any new songs as needed.
 * Automatically detects segue chains (intro/outro sandwiches, Reprise patterns)
 * and sets jams_into relationships.
 *
 * Usage:
 *   node scripts/sync-setlists.js
 *   node scripts/sync-setlists.js --dry-run          (preview, no writes)
 *   node scripts/sync-setlists.js --date 2025-09-17  (single date)
 *   node scripts/sync-setlists.js --fix-chains        (re-apply chain detection to existing shows)
 *   node scripts/sync-setlists.js --fix-chains --date 2025-09-16
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
const FIX_CHAINS = process.argv.includes('--fix-chains');
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

        for (const s of (setData.song || [])) {
            if (!s.name) continue;
            songs.push({
                title: s.name,
                isCover: !!s.cover,
                originalArtist: s.cover?.name || null,
                setNumber,
                songOrder: songs.length + 1,
                isEncore,
                rawInfo: s.info || null,
                jamsIntoNext: false
            });
        }

        if (!isEncore) setNumber++;
    }

    // Pattern 1 — explicit intro/outro: setlist.fm marks the wrapping song with
    // info="intro" at first occurrence and info="outro" at the return. Every song
    // between them (inclusive of intro, exclusive of outro) jams into the next.
    for (let i = 0; i < songs.length; i++) {
        if (songs[i].rawInfo === 'intro') {
            const outroIdx = songs.findIndex(
                (s, j) => j > i && s.rawInfo === 'outro' && s.title === songs[i].title
            );
            const end = outroIdx !== -1 ? outroIdx : songs.length - 1;
            for (let k = i; k < end; k++) songs[k].jamsIntoNext = true;
        }
    }

    // Pattern 2 — implicit Reprise: when a song returns with info="Reprise", every
    // song from its last occurrence up to (but not including) the reprise jams into
    // the next, creating the same indented sandwich.
    for (let i = 0; i < songs.length; i++) {
        if (songs[i].rawInfo === 'Reprise') {
            let prevIdx = -1;
            for (let j = i - 1; j >= 0; j--) {
                if (songs[j].title === songs[i].title) { prevIdx = j; break; }
            }
            if (prevIdx !== -1) {
                for (let k = prevIdx; k < i; k++) songs[k].jamsIntoNext = true;
            }
        }
    }

    // Derive the notes field: strip structural markers, keep everything else
    for (const song of songs) {
        const info = song.rawInfo;
        song.notes = (info === 'intro' || info === 'outro') ? null : info;
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

    const chainCount = songs.filter(s => s.jamsIntoNext).length;

    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would import ${songs.length} songs (${chainCount} with segue):`);
        songs.forEach((s, i) => {
            const isChained = i > 0 && songs[i - 1].jamsIntoNext;
            const prefix = isChained ? '      ›' : `    Set ${s.setNumber} #${s.songOrder}`;
            const cover = s.isCover ? ` (cover: ${s.originalArtist})` : '';
            const segue = s.jamsIntoNext ? ' >' : '';
            const note = s.notes ? ` [${s.notes}]` : '';
            console.log(`${prefix}: ${s.title}${cover}${note}${segue}`);
        });
        return songs.length;
    }

    // Resolve song IDs
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
            jams_into: null, // resolved below once all IDs are known
            performance_type: 'full'
        });
    }

    // Resolve jams_into: entries[i].jams_into = next entry's song_id
    for (let i = 0; i < songs.length; i++) {
        if (songs[i].jamsIntoNext && i + 1 < entries.length) {
            entries[i].jams_into = entries[i + 1].song_id;
        }
    }

    const { error } = await sb.from('setlist_songs').insert(entries);
    if (error) throw new Error(`DB insert failed: ${error.message}`);

    const segueCount = entries.filter(e => e.jams_into).length;
    if (segueCount > 0) console.log(`  (${segueCount} segue relationships linked)`);

    return entries.length;
}

async function fixChainsForShow(show, setlistData) {
    const sets = setlistData.sets?.set || [];
    const songs = parseSets(sets);
    const chains = songs.map((s, i) => ({
        idx: i,
        jamsIntoNext: s.jamsIntoNext,
        nextTitle: s.jamsIntoNext ? songs[i + 1]?.title : null
    })).filter(s => s.jamsIntoNext);

    if (chains.length === 0) {
        console.log('  no segue chains found');
        return 0;
    }

    // Fetch existing setlist_songs rows ordered by song_order
    const { data: rows, error } = await sb
        .from('setlist_songs')
        .select('id, song_order, jams_into, songs!setlist_songs_song_id_fkey(id, title)')
        .eq('show_id', show.id)
        .order('song_order');

    if (error) throw new Error(error.message);

    // Match by position (1-indexed song_order → 0-indexed songs array)
    const updates = [];
    for (const chain of chains) {
        const row = rows[chain.idx];         // row at this position
        const nextRow = rows[chain.idx + 1]; // row at next position
        if (!row || !nextRow) continue;

        const nextSongId = nextRow.songs?.id;
        if (!nextSongId) continue;

        // Skip if already correct
        if (row.jams_into === nextSongId) continue;

        if (DRY_RUN) {
            console.log(`  [DRY RUN] Would link: "${row.songs?.title}" > "${nextRow.songs?.title}"`);
            updates.push(row.id);
        } else {
            const { error: upErr } = await sb
                .from('setlist_songs')
                .update({ jams_into: nextSongId })
                .eq('id', row.id);
            if (upErr) throw new Error(upErr.message);
            updates.push(row.id);
        }
    }

    if (updates.length > 0) {
        if (!DRY_RUN) console.log(`  ✅ Linked ${updates.length} segue(s)`);
    } else {
        console.log(`  already up to date`);
    }

    return updates.length;
}

async function main() {
    console.log('='.repeat(50));
    console.log('BlueskiesBase — Setlist Sync');
    if (DRY_RUN) console.log('DRY RUN MODE — no changes will be written');
    if (FIX_CHAINS) console.log('FIX CHAINS MODE — updating jams_into on existing shows');
    if (SINGLE_DATE) console.log(`Targeting single date: ${SINGLE_DATE}`);
    console.log('='.repeat(50) + '\n');

    // ── FIX CHAINS MODE ─────────────────────────────────────────────────────
    if (FIX_CHAINS) {
        let query = sb.from('shows').select('id, show_date, venues(name, city)').order('show_date');
        if (SINGLE_DATE) query = query.eq('show_date', SINGLE_DATE);
        const { data: allShows, error: showsErr } = await query;
        if (showsErr) throw showsErr;

        // Only process shows that actually have songs
        const populated = [];
        for (const show of allShows) {
            const { count } = await sb.from('setlist_songs')
                .select('*', { count: 'exact', head: true })
                .eq('show_id', show.id);
            if (count > 0) populated.push({ ...show, songCount: count });
        }

        console.log(`Found ${populated.length} show(s) with existing setlist data.\n`);
        let fixed = 0, notFound = 0, errors = 0;

        for (const show of populated) {
            const label = `${show.show_date}  ${show.venues?.name}, ${show.venues?.city}`;
            process.stdout.write(`${label}\n  Fetching from setlist.fm... `);
            try {
                const setlist = await fetchSetlistForDate(show.show_date);
                if (!setlist) { console.log('not found'); notFound++; continue; }
                console.log(`matched: ${setlist.venue?.name}`);
                const n = await fixChainsForShow(show, setlist);
                if (n > 0) fixed++;
            } catch (err) {
                console.log(`  ❌ ${err.message}`);
                errors++;
            }
            console.log('');
        }

        console.log('='.repeat(50));
        console.log(`Shows checked:     ${populated.length}`);
        console.log(`${DRY_RUN ? 'Would update' : 'Updated'}:         ${fixed}`);
        console.log(`Not on setlist.fm: ${notFound}`);
        console.log(`Errors:            ${errors}`);
        console.log('='.repeat(50));
        return;
    }

    // ── NORMAL IMPORT MODE ──────────────────────────────────────────────────
    let query = sb.from('shows')
        .select('id, show_date, venues(name, city)')
        .order('show_date');
    if (SINGLE_DATE) query = query.eq('show_date', SINGLE_DATE);

    const { data: allShows, error: showsErr } = await query;
    if (showsErr) throw showsErr;

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

            console.log(`matched: ${setlist.venue?.name || '?'}`);

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
