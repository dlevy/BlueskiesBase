require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findCombinedSongs() {
    console.log('\n🔍 Searching for songs with "/" (multiple songs combined)...\n');

    // Get all songs with "/" in the title
    const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('id, title, is_original, original_artist')
        .ilike('title', '%/%')
        .order('title');

    if (songsError) {
        console.error('Error fetching songs:', songsError);
        return;
    }

    console.log(`Found ${songs.length} songs with "/" in the title:\n`);
    console.log('='.repeat(80));

    for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        console.log(`\n${i + 1}. "${song.title}"`);
        console.log(`   Song ID: ${song.id}`);
        console.log(`   Type: ${song.is_original ? 'Original' : 'Cover by ' + song.original_artist}`);

        // Get all setlist entries for this song
        const { data: setlistEntries, error: setlistError } = await supabase
            .from('setlist_songs')
            .select(`
                id,
                show_id,
                set_number,
                song_order,
                shows (
                    show_date,
                    venues (
                        name,
                        city,
                        state_country
                    )
                )
            `)
            .eq('song_id', song.id)
            .order('shows(show_date)', { ascending: false });

        if (setlistError) {
            console.error('   Error fetching setlist entries:', setlistError);
            continue;
        }

        console.log(`   Times Played: ${setlistEntries.length}`);
        
        if (setlistEntries.length > 0) {
            console.log(`   \n   📅 Shows where this song was played:`);
            setlistEntries.forEach((entry, idx) => {
                const show = entry.shows;
                const venue = show.venues;
                const date = new Date(show.show_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                console.log(`      ${idx + 1}. ${date} - ${venue.name}, ${venue.city}, ${venue.state_country}`);
                console.log(`         Setlist Entry ID: ${entry.id} | Show ID: ${entry.show_id} | Set ${entry.set_number}, Song #${entry.song_order}`);
            });
        }

        console.log('\n' + '-'.repeat(80));
    }

    console.log('\n\n📊 SUMMARY:');
    console.log(`   Total songs with "/" found: ${songs.length}`);
    console.log(`   These songs should be split into individual songs and updated in setlists.\n`);
}

findCombinedSongs().catch(console.error);

