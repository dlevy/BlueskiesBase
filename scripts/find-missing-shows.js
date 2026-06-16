/**
 * Compares early_concerts_2005-2015.json against the DB and writes
 * missing-shows.json containing only shows not already in the DB.
 *
 * Match key: show_date + normalised city name
 * (venue names differ too much across sources to use them reliably)
 *
 * Usage:  node scripts/find-missing-shows.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

function normaliseCity(city) {
    return (city || '').toLowerCase().trim()
        // common aliases
        .replace(/^st\.?\s+/,  'st. ')
        .replace(/^saint\s+/,  'st. ')
        .replace(/^west\s+/,   'west ')
        // strip trailing borough / state suffixes that appear in some records
        .replace(/,.*$/, '')
        .trim();
}

function makeKey(date, city) {
    return `${date}|${normaliseCity(city)}`;
}

async function fetchAllDbShows() {
    const PAGE = 1000;
    let offset = 0;
    const rows = [];

    while (true) {
        const { data, error } = await supabase
            .from('shows')
            .select('show_date, venues(city)')
            .range(offset, offset + PAGE - 1)
            .order('show_date', { ascending: true });

        if (error) throw new Error(`Supabase error: ${error.message}`);
        if (!data.length) break;
        rows.push(...data);
        if (data.length < PAGE) break;
        offset += PAGE;
    }

    return rows;
}

async function main() {
    console.log('Fetching shows from database…');
    const dbShows = await fetchAllDbShows();
    console.log(`  → ${dbShows.length} shows found in DB`);

    // Build a Set of (date|city) keys from the DB
    const dbKeys = new Set();
    for (const show of dbShows) {
        const city = show.venues?.city ?? '';
        dbKeys.add(makeKey(show.show_date, city));
    }

    // Load the import JSON
    const importPath = path.join(__dirname, '..', 'early_concerts_2005-2015.json');
    const importData = JSON.parse(fs.readFileSync(importPath, 'utf8'));
    console.log(`\nImport file contains ${importData.length} raw entries`);

    // Deduplicate the import JSON by (date, city) — keep first occurrence
    const seen = new Set();
    const deduped = [];
    for (const entry of importData) {
        const key = makeKey(entry.event_date, entry.venue_city);
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(entry);
        }
    }
    console.log(`  → ${deduped.length} unique (date + city) combinations`);

    // Find entries not already in the DB
    const missing = deduped.filter(entry => {
        const key = makeKey(entry.event_date, entry.venue_city);
        return !dbKeys.has(key);
    });

    console.log(`\n${missing.length} shows are missing from the DB`);
    if (missing.length === 0) {
        console.log('Nothing to do!');
        return;
    }

    // Sort by date for readability
    missing.sort((a, b) => a.event_date.localeCompare(b.event_date));

    // Print a quick summary
    console.log('\nMissing shows:');
    for (const s of missing) {
        console.log(`  ${s.event_date}  ${s.venue_city}, ${s.venue_state || s.venue_country}  — ${s.venue_name}`);
    }

    // Write output file
    const outPath = path.join(__dirname, '..', 'missing-shows.json');
    fs.writeFileSync(outPath, JSON.stringify(missing, null, 2));
    console.log(`\nWrote ${missing.length} entries to missing-shows.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
