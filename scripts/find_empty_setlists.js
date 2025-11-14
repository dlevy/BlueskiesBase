/**
 * Find shows with empty setlists
 * This helps identify shows that may have lost data due to CASCADE deletion
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

async function findEmptySetlists() {
    try {
        console.log('Searching for shows with empty setlists...\n');

        // Get all shows
        const { data: shows, error: showsError } = await supabase
            .from('shows')
            .select(`
                id,
                show_date,
                artist_name,
                venues (
                    name,
                    city,
                    state_country
                )
            `)
            .order('show_date', { ascending: false });

        if (showsError) {
            console.error('Error fetching shows:', showsError);
            return;
        }

        console.log(`Found ${shows.length} total shows\n`);

        const emptyShows = [];

        for (const show of shows) {
            // Check if show has any setlist songs
            const { data: setlistSongs, error: setlistError } = await supabase
                .from('setlist_songs')
                .select('id')
                .eq('show_id', show.id)
                .limit(1);

            if (setlistError) {
                console.error(`Error checking setlist for show ${show.id}:`, setlistError);
                continue;
            }

            if (!setlistSongs || setlistSongs.length === 0) {
                emptyShows.push(show);
            }
        }

        console.log('=== SHOWS WITH EMPTY SETLISTS ===\n');

        if (emptyShows.length === 0) {
            console.log('✓ No shows with empty setlists found!');
        } else {
            console.log(`Found ${emptyShows.length} show(s) with empty setlists:\n`);

            emptyShows.forEach((show, index) => {
                const venue = show.venues;
                const venueStr = venue 
                    ? `${venue.name} - ${venue.city}, ${venue.state_country}`
                    : 'Unknown Venue';

                console.log(`${index + 1}. ${show.show_date} - ${show.artist_name}`);
                console.log(`   ${venueStr}`);
                console.log(`   Show ID: ${show.id}`);
                console.log('');
            });

            console.log('\n=== NEXT STEPS ===');
            console.log('For each empty show:');
            console.log('1. Check if the show should have a setlist (not a future show)');
            console.log('2. Search for the setlist on setlist.fm');
            console.log('3. Create a restore script or manually re-enter the setlist');
            console.log('4. Run the fix_song_delete_cascade.sql migration to prevent future data loss');
        }

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

findEmptySetlists();

