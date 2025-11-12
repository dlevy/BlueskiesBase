require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function verifyDatabaseState() {
    console.log('📊 VERIFYING DATABASE STATE...\n');

    // Get counts
    const { count: shows } = await supabase
        .from('shows')
        .select('*', { count: 'exact', head: true });

    const { count: songs } = await supabase
        .from('songs')
        .select('*', { count: 'exact', head: true });

    const { count: setlistSongs } = await supabase
        .from('setlist_songs')
        .select('*', { count: 'exact', head: true });

    // Get shows without setlists
    const { data: allShows } = await supabase
        .from('shows')
        .select('id');

    const { data: showsWithSetlists } = await supabase
        .from('setlist_songs')
        .select('show_id');

    const showIdsWithSetlists = new Set(showsWithSetlists.map(s => s.show_id));
    const showsWithoutSetlists = allShows.filter(s => !showIdsWithSetlists.has(s.id));

    console.log('==========================================');
    console.log('📈 DATABASE COUNTS:');
    console.log('==========================================');
    console.log(`Total Shows:              ${shows}`);
    console.log(`Total Songs:              ${songs}`);
    console.log(`Total Setlist Entries:    ${setlistSongs}`);
    console.log('');
    console.log('==========================================');
    console.log('📊 SETLIST COVERAGE:');
    console.log('==========================================');
    console.log(`Shows WITH setlists:      ${shows - showsWithoutSetlists.length}`);
    console.log(`Shows WITHOUT setlists:   ${showsWithoutSetlists.length}`);
    console.log('');
    console.log('==========================================');
    console.log('🎯 COMPARISON:');
    console.log('==========================================');
    console.log(`Expected setlist entries: ~5,836`);
    console.log(`Actual setlist entries:   ${setlistSongs}`);
    console.log(`Difference:               ${setlistSongs - 5836}`);
    console.log('');

    if (setlistSongs >= 5836) {
        console.log('✅ SUCCESS! All setlist data has been restored!');
    } else {
        console.log('⚠️  WARNING: Still missing some setlist entries');
    }

    console.log('==========================================\n');
}

verifyDatabaseState().catch(console.error);

