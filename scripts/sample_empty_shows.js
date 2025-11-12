require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sampleEmptyShows() {
    console.log('\n📋 Sample of Shows with No Setlist Entries\n');
    console.log('='.repeat(80));

    // Get all shows
    const { data: allShows, error } = await supabase
        .from('shows')
        .select('id, show_date, venues(name, city, state_country)')
        .order('show_date', { ascending: false });

    if (error) {
        console.error('Error fetching shows:', error);
        return;
    }

    const emptyShows = [];

    for (const show of allShows) {
        const { count, error: countError } = await supabase
            .from('setlist_songs')
            .select('id', { count: 'exact', head: true })
            .eq('show_id', show.id);

        if (countError) continue;
        if (count === 0) emptyShows.push(show);
    }

    console.log(`\nTotal empty shows: ${emptyShows.length} out of ${allShows.length} total shows\n`);
    console.log('='.repeat(80));

    // Show a diverse sample - recent, middle, and old shows
    const samples = [
        { label: '🔴 RECENT SHOWS (2020)', shows: emptyShows.filter(s => s.show_date.startsWith('2020')).slice(0, 3) },
        { label: '🟡 MID-PERIOD SHOWS (2016-2017)', shows: emptyShows.filter(s => s.show_date.startsWith('2016') || s.show_date.startsWith('2017')).slice(0, 3) },
        { label: '🟢 OLDER SHOWS (2014-2015)', shows: emptyShows.filter(s => s.show_date.startsWith('2014') || s.show_date.startsWith('2015')).slice(0, 3) },
        { label: '🔵 EARLIEST SHOWS (2013)', shows: emptyShows.filter(s => s.show_date.startsWith('2013')).slice(0, 3) }
    ];

    for (const sample of samples) {
        console.log(`\n${sample.label}`);
        console.log('-'.repeat(80));
        
        for (const show of sample.shows) {
            const venue = show.venues;
            const date = new Date(show.show_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
            
            console.log(`\n📅 ${date}`);
            console.log(`   ${venue.name}`);
            console.log(`   ${venue.city}${venue.state_country ? ', ' + venue.state_country : ''}`);
            console.log(`   Show ID: ${show.id}`);
            console.log(`   Date: ${show.show_date}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 INSTRUCTIONS:');
    console.log('   1. Pick a few shows from above');
    console.log('   2. Check if they have setlists on setlist.fm');
    console.log('   3. Check if they appear in your frontend (http://localhost:5173)');
    console.log('   4. Let me know what you find!\n');
}

sampleEmptyShows().catch(console.error);

