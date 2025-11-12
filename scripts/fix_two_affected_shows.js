require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// The 2 shows that lost their setlists during cleanup
const SHOWS_TO_FIX = [
    {
        date: '2016-11-18',
        venue: 'Fox Theater',
        city: 'Bakersfield',
        // From the original combined song: "Call to Arms / The Motivator"
        expectedSongs: ['Call to Arms', 'The Motivator']
    },
    {
        date: '2015-08-24',
        venue: 'Noorderplantsoen',
        city: 'Groningen',
        // From the original combined song: "Paradiso Grote Zaal / Amsterdam"
        // Actually this might be wrong - let me check the original data
        expectedSongs: [] // We'll need to look this up
    }
];

async function checkShows() {
    console.log('\n🔍 Checking the 2 affected shows...\n');
    console.log('='.repeat(80));

    for (const showInfo of SHOWS_TO_FIX) {
        console.log(`\n📅 ${showInfo.date} - ${showInfo.venue}, ${showInfo.city}`);
        
        const { data: shows } = await supabase
            .from('shows')
            .select('id, show_date, venues(name, city)')
            .eq('show_date', showInfo.date);

        if (!shows || shows.length === 0) {
            console.log('   ❌ Show not found in database');
            continue;
        }

        const show = shows[0];
        console.log(`   Show ID: ${show.id}`);

        const { count } = await supabase
            .from('setlist_songs')
            .select('id', { count: 'exact', head: true })
            .eq('show_id', show.id);

        console.log(`   Current setlist entries: ${count}`);
        
        if (showInfo.expectedSongs.length > 0) {
            console.log(`   Expected songs: ${showInfo.expectedSongs.join(', ')}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 NEXT STEPS:');
    console.log('   1. Check setlist.fm for these 2 shows');
    console.log('   2. Manually verify what songs should be in each setlist');
    console.log('   3. Create a script to insert the correct setlist entries');
    console.log('');
}

checkShows().catch(console.error);

