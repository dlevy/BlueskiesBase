/**
 * Import Mutiny for the Masses 2026 Tour shows
 *
 * Usage:
 *   node scripts/import-2026-tour.js           (live run)
 *   node scripts/import-2026-tour.js --dry-run  (preview, no writes)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

const TOUR_NAME = 'Mutiny for the Masses 2026 Tour';
const ARTIST_NAME = 'Johnny Blue Skies';

const SHOWS = [
    { date: '2026-09-04', venue: 'Moody Center',                city: 'Austin',         state_country: 'TX' },
    { date: '2026-09-06', venue: 'Rio Rancho Events Center',    city: 'Albuquerque',    state_country: 'NM' },
    { date: '2026-09-08', venue: 'Desert Diamond Arena',        city: 'Glendale',       state_country: 'AZ' },
    { date: '2026-09-09', venue: 'Santa Barbara Bowl',          city: 'Santa Barbara',  state_country: 'CA' },
    { date: '2026-09-11', venue: 'Kia Forum',                   city: 'Los Angeles',    state_country: 'CA' },
    { date: '2026-09-13', venue: 'Viejas Arena',                city: 'San Diego',      state_country: 'CA' },
    { date: '2026-09-15', venue: 'The Greek Theatre',           city: 'Berkeley',       state_country: 'CA' },
    { date: '2026-09-18', venue: 'Climate Pledge Arena',        city: 'Seattle',        state_country: 'WA' },
    { date: '2026-09-19', venue: 'Pacific Coliseum',            city: 'Vancouver',      state_country: 'BC, Canada' },
    { date: '2026-09-21', venue: 'Matthew Knight Arena',        city: 'Eugene',         state_country: 'OR' },
    { date: '2026-09-23', venue: 'Ball Arena',                  city: 'Denver',         state_country: 'CO' },
    { date: '2026-09-26', venue: 'T-Mobile Center',             city: 'Kansas City',    state_country: 'MO' },
    { date: '2026-09-27', venue: 'Grand Casino Arena',          city: 'Saint Paul',     state_country: 'MN' },
    { date: '2026-09-29', venue: 'United Center',               city: 'Chicago',        state_country: 'IL' },
    { date: '2026-10-02', venue: 'Bridgestone Arena',           city: 'Nashville',      state_country: 'TN' },
    { date: '2026-10-03', venue: 'Gainbridge Fieldhouse',       city: 'Indianapolis',   state_country: 'IN' },
    { date: '2026-10-06', venue: 'Enterprise Center',           city: 'Saint Louis',    state_country: 'MO' },
    { date: '2026-10-07', venue: 'Nationwide Arena',            city: 'Columbus',       state_country: 'OH' },
    { date: '2026-10-09', venue: 'Petersen Events Center',      city: 'Pittsburgh',     state_country: 'PA' },
    { date: '2026-10-10', venue: 'Little Caesars Arena',        city: 'Detroit',        state_country: 'MI' },
    { date: '2026-10-13', venue: 'TD Garden',                   city: 'Boston',         state_country: 'MA' },
    { date: '2026-10-15', venue: 'Xfinity Mobile Arena',        city: 'Philadelphia',   state_country: 'PA' },
    { date: '2026-10-16', venue: 'Barclays Center',             city: 'Brooklyn',       state_country: 'NY' },
    { date: '2026-10-18', venue: 'Capital One Arena',           city: 'Washington',     state_country: 'DC' },
    { date: '2026-10-21', venue: 'Lenovo Center',               city: 'Raleigh',        state_country: 'NC' },
    { date: '2026-10-23', venue: 'Credit One Stadium',          city: 'Charleston',     state_country: 'SC' },
    { date: '2026-10-25', venue: 'State Farm Arena',            city: 'Atlanta',        state_country: 'GA' },
    { date: '2026-10-27', venue: 'Lakefront Arena',             city: 'New Orleans',    state_country: 'LA' },
    { date: '2026-10-30', venue: 'Rupp Arena',                  city: 'Lexington',      state_country: 'KY' },
];

async function getOrCreateVenue(name, city, state_country) {
    const { data } = await sb.from('venues').select('id').eq('name', name).eq('city', city).limit(1);
    if (data?.length > 0) return data[0].id;

    const { data: created, error } = await sb.from('venues')
        .insert({ name, city, state_country })
        .select('id')
        .single();

    if (error) throw new Error(`Failed to create venue "${name}": ${error.message}`);
    console.log(`    [new venue] ${name}, ${city}`);
    return created.id;
}

async function main() {
    console.log('='.repeat(55));
    console.log(`BlueskiesBase — Import ${TOUR_NAME}`);
    if (DRY_RUN) console.log('DRY RUN — no writes');
    console.log('='.repeat(55) + '\n');

    let created = 0, skipped = 0, errors = 0;

    for (const show of SHOWS) {
        const label = `${show.date}  ${show.venue}, ${show.city}`;
        try {
            // Check if this show already exists (by date + venue name + city)
            const { data: existingVenue } = await sb
                .from('venues').select('id').eq('name', show.venue).eq('city', show.city).limit(1);

            if (existingVenue?.length > 0) {
                const { data: existingShow } = await sb
                    .from('shows').select('id')
                    .eq('show_date', show.date)
                    .eq('venue_id', existingVenue[0].id)
                    .limit(1);

                if (existingShow?.length > 0) {
                    console.log(`  SKIP  ${label}`);
                    skipped++;
                    continue;
                }
            }

            if (DRY_RUN) {
                console.log(`  DRY   ${label}`);
                created++;
                continue;
            }

            const venueId = await getOrCreateVenue(show.venue, show.city, show.state_country);

            const { error } = await sb.from('shows').insert({
                show_date: show.date,
                venue_id: venueId,
                artist_name: ARTIST_NAME,
                tour_name: TOUR_NAME,
            });

            if (error) throw error;

            console.log(`  ✅    ${label}`);
            created++;
        } catch (err) {
            console.log(`  ❌    ${label}: ${err.message}`);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(55));
    console.log(`${DRY_RUN ? 'Would create' : 'Created'}:  ${created}`);
    console.log(`Skipped:   ${skipped}`);
    console.log(`Errors:    ${errors}`);
    console.log('='.repeat(55));
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
