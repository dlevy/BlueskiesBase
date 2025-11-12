require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parse command line arguments
const DRY_RUN = !process.argv.includes('--execute');

// List of affected shows from the dry-run output
const AFFECTED_SHOWS = [
    { date: '2014-07-02', venue: 'Plumas-Sierra County Fairgrounds', city: 'Quincy' },
    { date: '2017-10-13', venue: 'Smart Financial Centre at Sugar Land', city: 'Sugar Land' },
    { date: '2017-09-07', venue: 'Verizon Theatre at Grand Prairie', city: 'Grand Prairie' },
    { date: '2020-02-27', venue: 'Rupp Arena', city: 'Lexington' },
    { date: '2020-01-25', venue: 'Gruenspan', city: 'Hamburg' },
    { date: '2020-01-24', venue: 'Melkweg The Max', city: 'Amsterdam' },
    { date: '2019-10-07', venue: 'The Stone Pony', city: 'Asbury Park' },
    { date: '2018-09-20', venue: 'Xfinity Center', city: 'Mansfield' },
    { date: '2018-09-14', venue: 'Overland Park Golf Course', city: 'Denver' },
    { date: '2018-07-26', venue: 'Fort Adams State Park', city: 'Newport' },
    { date: '2018-07-03', venue: 'Austin360 Amphitheater', city: 'Austin' },
    { date: '2016-11-18', venue: 'Fox Theater', city: 'Oakland' },
    { date: '2016-10-07', venue: 'Kings Theatre', city: 'Brooklyn' },
    { date: '2025-05-11', venue: 'Skyla Credit Union Amphitheatre', city: 'Charlotte' },
    { date: '2020-02-29', venue: 'Masonic Temple Theatre', city: 'Detroit' },
    { date: '2020-02-28', venue: 'Masonic Temple Theatre', city: 'Detroit' },
    { date: '2018-10-20', venue: 'Hollywood Bowl', city: 'Los Angeles' },
    { date: '2017-09-20', venue: 'The Fabulous Fox Theatre', city: 'St. Louis' },
    { date: '2017-07-06', venue: 'Charlotte Metro Credit Union Amphitheatre', city: 'Charlotte' },
    { date: '2017-05-06', venue: 'Tom Lee Park', city: 'Memphis' },
    { date: '2017-05-05', venue: 'The Wharf Amphitheater', city: 'Orange Beach' },
    { date: '2016-10-06', venue: 'The Fillmore Philadelphia', city: 'Philadelphia' },
    { date: '2015-09-23', venue: 'Lincoln Theatre', city: 'Washington' },
    { date: '2015-08-24', venue: 'Paradiso Grote Zaal', city: 'Amsterdam' },
    { date: '2015-12-06', venue: 'Tabernacle', city: 'Atlanta' },
    { date: '2015-10-29', venue: 'Ryman Auditorium', city: 'Nashville' },
    { date: '2015-09-05', venue: 'Bluestem Amphitheater', city: 'Moorhead' }
];

// Mapping for combined songs to individual songs with jams_into
const COMBINED_SONG_MAPPINGS = {
    'A Little Light / Living the Dream': [
        { title: 'A Little Light', jamsInto: 'Living the Dream' },
        { title: 'Living the Dream', jamsInto: null }
    ],
    'Call to Arms / Get it On': [
        { title: 'Call to Arms', jamsInto: 'Get it On' },
        { title: 'Get it On', jamsInto: null }
    ],
    'Call to Arms / Going Down': [
        { title: 'Call to Arms', jamsInto: 'Going Down' },
        { title: 'Going Down', jamsInto: null }
    ],
    'Call to Arms / The Motivator': [
        { title: 'Call to Arms', jamsInto: 'The Motivator' },
        { title: 'The Motivator', jamsInto: null }
    ],
    'Call to Arms / The Motivator / Machine Gun': [
        { title: 'Call to Arms', jamsInto: 'The Motivator' },
        { title: 'The Motivator', jamsInto: 'Machine Gun' },
        { title: 'Machine Gun', jamsInto: null }
    ],
    'Instrumental Jam / Going Down': [
        { title: 'Instrumental Jam', jamsInto: 'Going Down' },
        { title: 'Going Down', jamsInto: null }
    ],
    'Long White Line / When the Levee Breaks': [
        { title: 'Long White Line', jamsInto: 'When the Levee Breaks' },
        { title: 'When the Levee Breaks', jamsInto: null }
    ],
    'Medicine Springs / Sharecropper\'s Son': [
        { title: 'Medicine Springs', jamsInto: 'Sharecropper\'s Son' },
        { title: 'Sharecropper\'s Son', jamsInto: null }
    ],
    'Poor Rambler / Sharecroppers Son': [
        { title: 'Poor Rambler', jamsInto: 'Sharecropper\'s Son' },
        { title: 'Sharecropper\'s Son', jamsInto: null }
    ],
    'Some Days / California Women': [
        { title: 'Some Days', jamsInto: 'California Women' },
        { title: 'California Women', jamsInto: null }
    ]
};

async function findOrCreateSong(songTitle, originalArtist = null) {
    // Search for existing song (case-insensitive)
    const { data: existingSongs, error: searchError } = await supabase
        .from('songs')
        .select('id, title, is_original, original_artist')
        .ilike('title', songTitle);

    if (searchError) {
        console.error(`   ❌ Error searching for song "${songTitle}":`, searchError);
        return null;
    }

    if (existingSongs && existingSongs.length > 0) {
        return existingSongs[0];
    }

    // Song doesn't exist - create it
    const isOriginal = !originalArtist;
    console.log(`   🆕 Creating new song: "${songTitle}" (${isOriginal ? 'Original' : 'Cover by ' + originalArtist})`);

    const { data: newSong, error: createError } = await supabase
        .from('songs')
        .insert([{
            title: songTitle,
            is_original: isOriginal,
            original_artist: originalArtist
        }])
        .select()
        .single();

    if (createError) {
        console.error(`   ❌ Error creating song "${songTitle}":`, createError);
        return null;
    }

    return newSong;
}

async function reimportShow(showInfo) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n📅 ${showInfo.date} - ${showInfo.venue}, ${showInfo.city}`);

    // Find the show in our database
    const { data: shows, error: showError } = await supabase
        .from('shows')
        .select('id, show_date, venues(name, city)')
        .eq('show_date', showInfo.date);

    if (showError || !shows || shows.length === 0) {
        console.error(`   ❌ Could not find show in database`);
        return;
    }

    const show = shows[0];
    console.log(`   Show ID: ${show.id}`);

    // Fetch setlist from setlist.fm
    const artistMbid = '93e5b95a-8d0e-4c2f-8e02-f0e23a4d6e84'; // Sturgill Simpson
    const [year, month, day] = showInfo.date.split('-');
    const apiUrl = `https://api.setlist.fm/rest/1.0/search/setlists?artistMbid=${artistMbid}&date=${day}-${month}-${year}`;

    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'x-api-key': process.env.SETLISTFM_API_KEY,
                'Accept': 'application/json'
            }
        });

        if (!response.data.setlist || response.data.setlist.length === 0) {
            console.error(`   ❌ No setlist found on setlist.fm`);
            return;
        }

        const setlist = response.data.setlist[0];
        console.log(`   ✅ Found setlist on setlist.fm`);

        // Delete existing setlist entries for this show
        const { error: deleteError } = await supabase
            .from('setlist_songs')
            .delete()
            .eq('show_id', show.id);

        if (deleteError) {
            console.error(`   ❌ Error deleting old setlist entries:`, deleteError);
            return;
        }

        console.log(`   🗑️  Deleted old setlist entries`);

        // Process each set
        let totalSongs = 0;
        for (const set of setlist.sets.set) {
            const setNumber = set.encore ? 2 : 1; // Simplified: encore = set 2
            let songOrder = 1;

            if (!set.song || set.song.length === 0) continue;

            for (const songData of set.song) {
                let songTitle = songData.name;
                const originalArtist = songData.cover ? songData.cover.name : null;

                // Check if this is a combined song that needs to be split
                const mapping = COMBINED_SONG_MAPPINGS[songTitle];

                if (mapping) {
                    // This is a combined song - split it
                    console.log(`   🎵 Splitting "${songTitle}" into ${mapping.length} songs`);

                    for (let i = 0; i < mapping.length; i++) {
                        const individualSong = mapping[i];
                        const song = await findOrCreateSong(individualSong.title, originalArtist);

                        if (!song) continue;

                        // Find jams_into song ID if applicable
                        let jamsIntoId = null;
                        if (individualSong.jamsInto) {
                            const jamsIntoSong = await findOrCreateSong(individualSong.jamsInto, originalArtist);
                            jamsIntoId = jamsIntoSong ? jamsIntoSong.id : null;
                        }

                        const { error: insertError } = await supabase
                            .from('setlist_songs')
                            .insert([{
                                show_id: show.id,
                                song_id: song.id,
                                set_number: setNumber,
                                song_order: songOrder,
                                is_encore: set.encore ? true : false,
                                jams_into: jamsIntoId
                            }]);

                        if (insertError) {
                            console.error(`      ❌ Error inserting "${individualSong.title}":`, insertError);
                        } else {
                            console.log(`      ✅ Inserted "${individualSong.title}" at position ${songOrder}${jamsIntoId ? ' (jams into next)' : ''}`);
                            totalSongs++;
                        }

                        songOrder++;
                    }
                } else {
                    // Regular song - insert as-is
                    const song = await findOrCreateSong(songTitle, originalArtist);

                    if (!song) {
                        songOrder++;
                        continue;
                    }

                    const { error: insertError } = await supabase
                        .from('setlist_songs')
                        .insert([{
                            show_id: show.id,
                            song_id: song.id,
                            set_number: setNumber,
                            song_order: songOrder,
                            is_encore: set.encore ? true : false
                        }]);

                    if (insertError) {
                        console.error(`      ❌ Error inserting "${songTitle}":`, insertError);
                    } else {
                        totalSongs++;
                    }

                    songOrder++;
                }
            }
        }

        console.log(`   ✅ Imported ${totalSongs} songs`);

    } catch (error) {
        console.error(`   ❌ Error fetching from setlist.fm:`, error.message);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
}

async function main() {
    console.log('\n🔄 Re-importing Affected Shows');
    console.log('='.repeat(80));
    console.log(`\nTotal shows to re-import: ${AFFECTED_SHOWS.length}\n`);

    for (const showInfo of AFFECTED_SHOWS) {
        await reimportShow(showInfo);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Re-import complete!\n');
}

main().catch(console.error);

