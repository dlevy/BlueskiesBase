// One-time backfill: populates venues.state / venues.country from the
// existing free-text venues.state_country column. state_country itself is
// NEVER written here — buildShowPath() (client/src/utils/showSlug.js)
// slugifies it directly into every show's URL, so it must keep its exact
// existing value or current /show/... links would change.
//
// Usage:
//   node scripts/backfill_venue_state_country.js            (dry run — prints the parse table, writes nothing)
//   node scripts/backfill_venue_state_country.js --write    (writes state/country for every venue)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Mirrors client/src/utils/geography.js's US_STATE_CODE_TO_NAME / US_STATE_NAMES.
const US_STATE_CODE_TO_NAME = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    DC: 'District of Columbia', PR: 'Puerto Rico',
};
const US_STATE_NAMES = new Set([
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina',
    'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
    'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
    'District of Columbia',
]);

function parseStateCountry(raw) {
    const sc = (raw || '').trim();
    if (!sc) return { state: null, country: null };

    const lastComma = sc.lastIndexOf(',');
    if (lastComma !== -1) {
        let state = sc.slice(0, lastComma).trim();
        const country = sc.slice(lastComma + 1).trim();
        if (state === 'ON') state = 'Ontario';
        if (state === 'Washington, D.C.') state = 'District of Columbia';
        return { state, country };
    }

    // No comma — a bare US state code/name, or a bare non-US country/region.
    if (US_STATE_CODE_TO_NAME[sc]) return { state: US_STATE_CODE_TO_NAME[sc], country: 'United States' };
    if (US_STATE_NAMES.has(sc)) return { state: sc, country: 'United States' };
    if (sc === 'UK') return { state: null, country: 'United Kingdom' };
    if (sc === 'Scotland') return { state: 'Scotland', country: 'United Kingdom' };
    if (sc === 'Ireland' || sc === 'Denmark' || sc === 'Norway') return { state: null, country: sc };

    // Unrecognized bare value — surfaced in the dry-run table rather than guessed at.
    return { state: null, country: sc, UNRECOGNIZED: true };
}

async function main() {
    const write = process.argv.includes('--write');

    const { data: venues, error } = await supabase.from('venues').select('id, name, city, state_country');
    if (error) throw error;
    console.log(`Loaded ${venues.length} venues.\n`);

    const distinctValues = [...new Set(venues.map(v => v.state_country))].sort();
    console.log(`${distinctValues.length} distinct state_country values. Parse table:\n`);
    let unrecognizedCount = 0;
    for (const raw of distinctValues) {
        const { state, country, UNRECOGNIZED } = parseStateCountry(raw);
        const flag = UNRECOGNIZED ? '  <-- UNRECOGNIZED' : '';
        if (UNRECOGNIZED) unrecognizedCount++;
        console.log(`  ${JSON.stringify(raw).padEnd(45)} -> state: ${JSON.stringify(state).padEnd(25)} country: ${JSON.stringify(country)}${flag}`);
    }
    console.log(`\n${unrecognizedCount} unrecognized value(s).`);

    if (!write) {
        console.log('\nDry run only — no writes made. Re-run with --write to apply.');
        return;
    }

    if (unrecognizedCount > 0) {
        console.error('\nRefusing to write: unrecognized values present. Fix parseStateCountry and re-run.');
        process.exit(1);
    }

    console.log('\n--write passed — updating every venue...');
    let updated = 0;
    for (const v of venues) {
        const { state, country } = parseStateCountry(v.state_country);
        const { error: updErr } = await supabase.from('venues').update({ state, country }).eq('id', v.id);
        if (updErr) {
            console.error(`  FAILED venue ${v.id} (${v.name}):`, updErr.message);
            continue;
        }
        updated++;
    }
    console.log(`\nUpdated ${updated}/${venues.length} venues.`);
}

main().catch(err => {
    console.error('BACKFILL FAILED:', err);
    process.exit(1);
});
