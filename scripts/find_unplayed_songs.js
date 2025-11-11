/**
 * Find all songs in the database that have never been played
 * (i.e., songs that don't have any entries in setlist_songs)
 */

require('dotenv').config();
const { supabase } = require('../server/config/supabase');

async function findUnplayedSongs() {
    console.log('🔍 Finding songs that have never been played...\n');

    try {
        // Get all songs with their performance count
        const { data: songs, error } = await supabase
            .from('songs')
            .select(`
                id,
                title,
                is_original,
                original_artist,
                written_by
            `)
            .order('title');

        if (error) {
            console.error('❌ Error fetching songs:', error);
            process.exit(1);
        }

        console.log(`📊 Total songs in database: ${songs.length}\n`);

        // For each song, check if it has any performances
        const unplayedSongs = [];
        
        for (const song of songs) {
            const { data: performances, error: perfError } = await supabase
                .from('setlist_songs')
                .select('id')
                .eq('song_id', song.id);

            if (perfError) {
                console.error(`❌ Error checking performances for "${song.title}":`, perfError);
                continue;
            }

            if (!performances || performances.length === 0) {
                unplayedSongs.push(song);
            }
        }

        console.log(`\n📋 UNPLAYED SONGS (${unplayedSongs.length} total):\n`);
        console.log('=' .repeat(80));

        if (unplayedSongs.length === 0) {
            console.log('✅ All songs in the database have been played at least once!');
        } else {
            // Group by type
            const unplayedCovers = unplayedSongs.filter(s => s.is_original === false);
            const unplayedOriginals = unplayedSongs.filter(s => s.is_original === true);
            const unplayedUnknown = unplayedSongs.filter(s => s.is_original === null);

            console.log(`\n🎸 UNPLAYED ORIGINALS (${unplayedOriginals.length}):`);
            unplayedOriginals.forEach(song => {
                console.log(`  - ${song.title}`);
                if (song.written_by) console.log(`    Written by: ${song.written_by}`);
            });

            console.log(`\n🎤 UNPLAYED COVERS (${unplayedCovers.length}):`);
            unplayedCovers.forEach(song => {
                console.log(`  - ${song.title}`);
                if (song.original_artist) console.log(`    Original artist: ${song.original_artist}`);
            });

            if (unplayedUnknown.length > 0) {
                console.log(`\n❓ UNPLAYED UNKNOWN TYPE (${unplayedUnknown.length}):`);
                unplayedUnknown.forEach(song => {
                    console.log(`  - ${song.title}`);
                });
            }

            console.log('\n' + '='.repeat(80));
            console.log('\n💡 RECOMMENDATION:');
            console.log('These songs should be removed from the database since they have never been played.');
            console.log('\nTo delete them, you can run:');
            console.log('  node scripts/delete_unplayed_songs.js');
        }

        // Summary statistics
        console.log('\n📊 SUMMARY:');
        console.log(`  Total songs in database: ${songs.length}`);
        console.log(`  Songs that have been played: ${songs.length - unplayedSongs.length}`);
        console.log(`  Songs never played: ${unplayedSongs.length}`);
        
        if (unplayedSongs.length > 0) {
            console.log(`    - Originals: ${unplayedOriginals.length}`);
            console.log(`    - Covers: ${unplayedCovers.length}`);
            if (unplayedUnknown.length > 0) {
                console.log(`    - Unknown type: ${unplayedUnknown.length}`);
            }
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    }
}

findUnplayedSongs();

