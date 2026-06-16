/**
 * Import shows from missing-shows.json that are not already in the DB.
 *
 * Duplicate guard: before every insert the script does a live DB query
 * by (show_date + venue city). If any show already exists on that date
 * in that city it is skipped — no overwrite, no duplicate.
 *
 * Usage:
 *   node scripts/import-missing-shows.js            (live run)
 *   node scripts/import-missing-shows.js --dry-run  (preview, no writes)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = process.argv.includes('--dry-run');
const ARTIST_NAME = 'Sturgill Simpson';

// ── US state full names → 2-letter postal abbreviations ───────────────────────
const US_STATE_ABBR = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
    'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME',
    'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
    'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
    'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
    'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
    'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
    'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
    'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
};

// Canadian provinces used in the source data
const CA_PROVINCE_ABBR = {
    'Ontario': 'ON', 'British Columbia': 'BC', 'Quebec': 'QC',
    'Alberta': 'AB', 'Manitoba': 'MB', 'Saskatchewan': 'SK',
};

/**
 * Build the state_country value for the venues table.
 * - US:     2-letter state code            e.g. "TN", "CA"
 * - Canada: province abbreviation + suffix e.g. "ON, Canada"
 * - UK:     "UK" (or "Wales, UK" / "Scotland" for regional entries)
 * - Other:  country name as-is             e.g. "Ireland", "Norway"
 */
function toStateCountry(entry) {
    const country = (entry.venue_country || '').trim();
    const state   = (entry.venue_state   || '').trim();

    if (country === 'United States') {
        return US_STATE_ABBR[state] || state || 'US';
    }

    if (country === 'Canada') {
        const abbr = CA_PROVINCE_ABBR[state];
        return abbr ? `${abbr}, Canada` : 'Canada';
    }

    // Source data uses "Scotland" and "Ireland" directly as venue_country
    if (country === 'Scotland') return 'Scotland';
    if (country === 'Ireland') return 'Ireland';

    if (country === 'United Kingdom') {
        if (state === 'Wales') return 'Wales, UK';
        if (state === 'Scotland') return 'Scotland';
        return 'UK';
    }

    // UK listed directly in source (most common case for British dates)
    if (country === 'UK') return 'UK';

    // European countries and anything else — use as-is
    return country || 'Unknown';
}

// ── Fetch the full set of existing (show_date|city) keys from the DB ──────────
async function fetchExistingKeys() {
    const keys = new Set();
    const PAGE = 1000;
    let offset = 0;

    while (true) {
        const { data, error } = await sb
            .from('shows')
            .select('show_date, venues(city)')
            .range(offset, offset + PAGE - 1);

        if (error) throw new Error(`DB read error: ${error.message}`);
        if (!data.length) break;

        for (const row of data) {
            const city = (row.venues?.city || '').toLowerCase().trim();
            keys.add(`${row.show_date}|${city}`);
        }

        if (data.length < PAGE) break;
        offset += PAGE;
    }

    return keys;
}

function makeKey(date, city) {
    return `${date}|${(city || '').toLowerCase().trim()}`;
}

// ── Venue: reuse existing or create new ───────────────────────────────────────
async function getOrCreateVenue(name, city, state_country) {
    // Match on exact name + city (case-sensitive, same as the rest of the app)
    const { data, error } = await sb
        .from('venues')
        .select('id')
        .eq('name', name)
        .eq('city', city)
        .limit(1);

    if (error) throw new Error(`Venue lookup error: ${error.message}`);
    if (data?.length > 0) return { id: data[0].id, created: false };

    const { data: created, error: insertErr } = await sb
        .from('venues')
        .insert({ name, city, state_country })
        .select('id')
        .single();

    if (insertErr) throw new Error(`Venue insert error: ${insertErr.message}`);
    return { id: created.id, created: true };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('='.repeat(60));
    console.log('BlueskiesBase — Import Missing Shows');
    if (DRY_RUN) console.log('DRY RUN — no writes will be made');
    console.log('='.repeat(60) + '\n');

    // Load missing-shows.json
    const inputPath = path.join(__dirname, '..', 'missing-shows.json');
    if (!fs.existsSync(inputPath)) {
        console.error('missing-shows.json not found. Run find-missing-shows.js first.');
        process.exit(1);
    }
    const shows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log(`Loaded ${shows.length} candidates from missing-shows.json`);

    // Build the existing-key set from DB (live, fresh)
    console.log('Fetching existing shows from DB for duplicate check…');
    const existingKeys = await fetchExistingKeys();
    console.log(`  → ${existingKeys.size} (date + city) pairs already in DB\n`);

    let inserted = 0, skipped = 0, venuesCreated = 0, errors = 0;

    for (const entry of shows) {
        const label = `${entry.event_date}  ${entry.venue_name}, ${entry.venue_city}`;
        const key   = makeKey(entry.event_date, entry.venue_city);

        // ── Duplicate guard ───────────────────────────────────────────────────
        if (existingKeys.has(key)) {
            console.log(`  SKIP  ${label}  (already in DB)`);
            skipped++;
            continue;
        }

        if (DRY_RUN) {
            const sc = toStateCountry(entry);
            console.log(`  DRY   ${label}  [${sc}]`);
            inserted++;
            continue;
        }

        try {
            const state_country = toStateCountry(entry);

            const { id: venueId, created: venueCreated } = await getOrCreateVenue(
                entry.venue_name,
                entry.venue_city,
                state_country,
            );
            if (venueCreated) venuesCreated++;

            const { error } = await sb.from('shows').insert({
                show_date:   entry.event_date,
                venue_id:    venueId,
                artist_name: ARTIST_NAME,
                tour_name:   entry.tour_name || null,
            });

            if (error) throw new Error(error.message);

            // Add this key to our local set so same-date/city in the same file
            // doesn't slip through on a second pass
            existingKeys.add(key);

            console.log(`  OK    ${label}  [${state_country}]${venueCreated ? '  +venue' : ''}`);
            inserted++;
        } catch (err) {
            console.log(`  ERR   ${label}  — ${err.message}`);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`${DRY_RUN ? 'Would insert' : 'Inserted'}:  ${inserted} shows`);
    if (!DRY_RUN) console.log(`New venues:  ${venuesCreated}`);
    console.log(`Skipped:     ${skipped}  (already in DB)`);
    console.log(`Errors:      ${errors}`);
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('\nFatal:', err.message);
    process.exit(1);
});
