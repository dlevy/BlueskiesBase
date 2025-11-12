require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SHOW_ID = '7e34e678-91dc-4457-8840-752d678f3ea9';

// Setlist from setlist.fm for September 16, 2025 at Red Rocks
// https://www.setlist.fm/setlist/sturgill-simpson/2025/red-rocks-amphitheatre-morrison-co-b405176.html
const SETLIST = [
    { title: 'A Whiter Shade of Pale', notes: null },
    { title: 'Brace for Impact (Live a Little)', notes: null },
    { title: 'Brace for Impact (Live a Little)', notes: 'Reprise After Weather Delay - 8:29 p.m. MT' },
    { title: 'You Don\'t Miss Your Water', notes: null },
    { title: 'Mint Tea', notes: null },
    { title: 'Right Kind of Dream', notes: null },
    { title: 'All Said and Done', notes: null },
    { title: 'Long White Line', notes: null },
    { title: 'Turtles All the Way Down', notes: null },
    { title: 'Living the Dream', notes: null },
    { title: 'Life of Sin', notes: null },
    { title: 'A Good Look', notes: null },
    { title: 'Lay Down Sally', notes: null },
    { title: 'A Good Look', notes: 'Reprise' },
    { title: 'Black Dog', notes: null },
    { title: 'L.A. Woman', notes: null },
    { title: 'Just Let Go', notes: null },
    { title: 'I\'d Have to Be Crazy', notes: null },
    { title: 'I Don\'t Mind', notes: null },
    { title: 'Fastest Horse in Town', notes: null },
    { title: 'Railroad of Sin', notes: null },
    { title: 'The Promise (Cover)', notes: null },
    { title: 'One for the Road', notes: null },
    { title: 'Scooter Blues', notes: null },
    { title: 'Jupiter\'s Faerie', notes: null },
    { title: 'Midnight Rider', notes: null },
    { title: 'Welcome to Earth (Pollywog)', notes: null },
    { title: 'It Ain\'t All Flowers', notes: null },
    { title: 'Party All the Time', notes: null },
    { title: 'It Ain\'t All Flowers', notes: 'Reprise' },
    { title: 'Best Clockmaker on Mars', notes: 'Bulls on Parade interpolation' }
];

async function restoreSetlist() {
    try {
        console.log('\n🔍 Fetching all songs from database...\n');
        
        // Get all songs
        const { data: allSongs, error: songsError } = await supabase
            .from('songs')
            .select('id, title');
        
        if (songsError) {
            console.error('❌ Error fetching songs:', songsError);
            return;
        }
        
        console.log(`✅ Found ${allSongs.length} songs in database\n`);
        
        // Create a map of song titles to IDs (case-insensitive)
        const songMap = {};
        allSongs.forEach(song => {
            songMap[song.title.toLowerCase()] = song.id;
        });
        
        // Build setlist entries
        const setlistEntries = [];
        const missingSongs = [];
        
        SETLIST.forEach((item, index) => {
            const songId = songMap[item.title.toLowerCase()];
            
            if (songId) {
                setlistEntries.push({
                    show_id: SHOW_ID,
                    song_id: songId,
                    set_number: 1,  // All one set
                    song_order: index + 1,
                    is_encore: false,
                    notes: item.notes,
                    jams_into: null
                });
                console.log(`✅ ${index + 1}. ${item.title}${item.notes ? ` (${item.notes})` : ''}`);
            } else {
                missingSongs.push(item.title);
                console.log(`❌ ${index + 1}. ${item.title} - NOT FOUND IN DATABASE`);
            }
        });
        
        if (missingSongs.length > 0) {
            console.log(`\n⚠️  Warning: ${missingSongs.length} songs not found in database:`);
            missingSongs.forEach(title => console.log(`   - ${title}`));
            console.log('\nYou may need to add these songs to the database first.\n');
        }
        
        if (setlistEntries.length === 0) {
            console.log('\n❌ No songs to restore (all songs missing from database)\n');
            return;
        }
        
        console.log(`\n📝 Restoring ${setlistEntries.length} songs to setlist...\n`);
        
        // Insert the setlist entries
        const { data, error } = await supabase
            .from('setlist_songs')
            .insert(setlistEntries)
            .select();
        
        if (error) {
            console.error('❌ Error inserting setlist:', error);
            return;
        }
        
        console.log(`✅ Successfully restored ${data.length} songs to the September 16, 2025 setlist!\n`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

restoreSetlist();

