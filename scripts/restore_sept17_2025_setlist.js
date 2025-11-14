/**
 * Restore September 17, 2025 Red Rocks setlist
 * This data was lost due to accidental song deletion with CASCADE constraint
 * Source: https://www.setlist.fm/setlist/sturgill-simpson/2025/red-rocks-amphitheatre-morrison-co-1b405168.html
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Setlist from setlist.fm for September 17, 2025
const setlistData = [
    { title: "Ronin", set: 1, order: 1 },
    { title: "If the Sun Never Rises Again", set: 1, order: 2, is_original: false, original_artist: "Johnny Blue Skies" },
    { title: "Spanish Moon", set: 1, order: 3, is_original: false, original_artist: "Little Feat" },
    { title: "Pinball Blues", set: 1, order: 4, is_original: false, original_artist: "Moore & Napier" },
    { title: "Long White Line", set: 1, order: 5, is_original: false, original_artist: "Moore & Napier" },
    { title: "Sitting Here Without You", set: 1, order: 6 },
    { title: "Red Red Wine", set: 1, order: 7, is_original: false, original_artist: "Neil Diamond" },
    { title: "The Storm", set: 1, order: 8 },
    { title: "Under the Sea", set: 1, order: 9, is_original: false, original_artist: "Alan Menken", notes: "SpongeBob Weir Square Dance" },
    { title: "Juanita", set: 1, order: 10 },
    { title: "Sing Along", set: 1, order: 11 },
    { title: "All Around You", set: 1, order: 12 },
    { title: "A Little Light", set: 1, order: 13 },
    { title: "One for the Road", set: 1, order: 14, is_original: false, original_artist: "Johnny Blue Skies" },
    { title: "Purple Rain", set: 1, order: 15, is_original: false, original_artist: "Prince" },
    { title: "It Ain't All Flowers", set: 1, order: 16 },
    { title: "Party All the Time", set: 1, order: 17, is_original: false, original_artist: "Eddie Murphy" },
    { title: "It Ain't All Flowers", set: 1, order: 18, notes: "Reprise" },
    { title: "Water in a Well", set: 1, order: 19 },
    { title: "Sometimes Wine", set: 1, order: 20, is_original: false, original_artist: "Sunday Valley" },
    { title: "Voices", set: 1, order: 21 },
    { title: "Welcome to Earth (Pollywog)", set: 1, order: 22 },
    { title: "Best Clockmaker on Mars", set: 1, order: 23, notes: "extended intro / SpongeBob Weir Square Dance reprise outro" },
    { title: "Breakers Roar", set: 1, order: 24 },
    { title: "In Bloom", set: 1, order: 25, is_original: false, original_artist: "Nirvana" },
    { title: "A Good Look", set: 1, order: 26 },
    { title: "La Grange", set: 1, order: 27, is_original: false, original_artist: "ZZ Top" },
    { title: "Living Loving Maid (She's Just a Woman)", set: 1, order: 28, is_original: false, original_artist: "Led Zeppelin" },
    { title: "A Good Look", set: 1, order: 29, notes: "Reprise" },
    { title: "You Can Have the Crown", set: 1, order: 30 },
    { title: "I Wonder", set: 1, order: 31, is_original: false, original_artist: "Sunday Valley" },
    { title: "All the Pretty Colors", set: 1, order: 32 },
    { title: "Turtles All the Way Down", set: 1, order: 33 },
    { title: "Fastest Horse in Town", set: 1, order: 34 },
    { title: "Brace for Impact (Live a Little)", set: 1, order: 35, notes: "China Cat Sunflower Interpolation" },
    { title: "Call to Arms", set: 1, order: 36, notes: "intro" },
    { title: "Rocky Mountain Way", set: 1, order: 37, is_original: false, original_artist: "Joe Walsh" },
    { title: "Call to Arms", set: 1, order: 38 },
    { title: "Band on the Run", set: 1, order: 39, is_original: false, original_artist: "Wings" },
    { title: "Machine Gun", set: 1, order: 40, is_original: false, original_artist: "Jimi Hendrix" },
    { title: "Call to Arms", set: 1, order: 41, notes: "outro" },
];

async function restoreSetlist() {
    try {
        console.log('Starting restore for September 17, 2025 Red Rocks show...\n');

        // Find the show
        const { data: shows, error: showError } = await supabase
            .from('shows')
            .select('*')
            .eq('show_date', '2025-09-17')
            .limit(1);

        if (showError) {
            console.error('Error finding show:', showError);
            return;
        }

        if (!shows || shows.length === 0) {
            console.error('Show not found for 2025-09-17');
            return;
        }

        const show = shows[0];
        console.log(`Found show: ${show.show_date} at ${show.artist_name}`);
        console.log(`Show ID: ${show.id}\n`);

        // Check if setlist already exists
        const { data: existing, error: existingError } = await supabase
            .from('setlist_songs')
            .select('id')
            .eq('show_id', show.id)
            .limit(1);

        if (existingError) {
            console.error('Error checking existing setlist:', existingError);
            return;
        }

        if (existing && existing.length > 0) {
            console.log('⚠️  Setlist already exists for this show. Skipping restore.');
            console.log('If you want to re-import, delete the existing setlist first.');
            return;
        }

        console.log(`Processing ${setlistData.length} songs...\n`);

        let successCount = 0;
        let errorCount = 0;

        for (const songData of setlistData) {
            try {
                // Find or create the song
                let { data: songs, error: songError } = await supabase
                    .from('songs')
                    .select('*')
                    .eq('title', songData.title)
                    .limit(1);

                if (songError) {
                    console.error(`Error finding song "${songData.title}":`, songError);
                    errorCount++;
                    continue;
                }

                let songId;
                if (!songs || songs.length === 0) {
                    // Create the song
                    const { data: newSong, error: createError } = await supabase
                        .from('songs')
                        .insert({
                            title: songData.title,
                            is_original: songData.is_original !== false,
                            original_artist: songData.original_artist || null
                        })
                        .select()
                        .single();

                    if (createError) {
                        console.error(`Error creating song "${songData.title}":`, createError);
                        errorCount++;
                        continue;
                    }

                    songId = newSong.id;
                    console.log(`✓ Created song: ${songData.title}`);
                } else {
                    songId = songs[0].id;
                }

                // Add to setlist
                const { error: setlistError } = await supabase
                    .from('setlist_songs')
                    .insert({
                        show_id: show.id,
                        song_id: songId,
                        set_number: songData.set,
                        song_order: songData.order,
                        notes: songData.notes || null,
                        is_encore: false
                    });

                if (setlistError) {
                    console.error(`Error adding "${songData.title}" to setlist:`, setlistError);
                    errorCount++;
                } else {
                    successCount++;
                }

            } catch (err) {
                console.error(`Unexpected error processing "${songData.title}":`, err);
                errorCount++;
            }
        }

        console.log('\n=== Restore Complete ===');
        console.log(`✓ Successfully added: ${successCount} songs`);
        if (errorCount > 0) {
            console.log(`✗ Errors: ${errorCount}`);
        }

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

restoreSetlist();

