require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findEmptyShows() {
    console.log('\n🔍 Finding shows with no setlist entries...\n');

    // Get all shows
    const { data: allShows, error } = await supabase
        .from('shows')
        .select('id, show_date, venues(name, city, state_country)')
        .order('show_date', { ascending: false });

    if (error) {
        console.error('Error fetching shows:', error);
        return;
    }

    console.log(`Total shows in database: ${allShows.length}\n`);

    const emptyShows = [];

    for (const show of allShows) {
        const { count, error: countError } = await supabase
            .from('setlist_songs')
            .select('id', { count: 'exact', head: true })
            .eq('show_id', show.id);

        if (countError) {
            console.error(`Error checking show ${show.id}:`, countError);
            continue;
        }

        if (count === 0) {
            emptyShows.push(show);
        }
    }

    console.log(`Shows with no setlist entries: ${emptyShows.length}\n`);
    console.log('='.repeat(80));

    emptyShows.forEach(show => {
        const venue = show.venues;
        console.log(`\n📅 ${show.show_date}`);
        console.log(`   ${venue.name}, ${venue.city}${venue.state_country ? ', ' + venue.state_country : ''}`);
        console.log(`   Show ID: ${show.id}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\nTotal: ${emptyShows.length} shows need setlists\n`);
}

findEmptyShows().catch(console.error);

