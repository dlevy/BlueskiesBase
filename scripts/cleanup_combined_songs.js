require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parse command line arguments
const DRY_RUN = !process.argv.includes('--execute');

// Mapping for known spelling variations
const SONG_TITLE_CORRECTIONS = {
    "Sharecroppers Son": "Sharecropper's Son"
};

async function cleanupCombinedSongs() {
    console.log('\n🧹 Combined Songs Cleanup Script');
    console.log('='.repeat(80));
    
    if (DRY_RUN) {
        console.log('🔍 DRY RUN MODE - No changes will be made to the database');
        console.log('   Run with --execute flag to apply changes\n');
    } else {
        console.log('⚠️  EXECUTE MODE - Changes will be made to the database!\n');
    }

    // Get all songs with "/" in the title
    const { data: combinedSongs, error: songsError } = await supabase
        .from('songs')
        .select('id, title, is_original, original_artist, written_by')
        .ilike('title', '%/%')
        .order('title');

    if (songsError) {
        console.error('❌ Error fetching songs:', songsError);
        return;
    }

    console.log(`Found ${combinedSongs.length} combined songs to process\n`);

    let totalSetlistEntries = 0;
    let totalSongsCreated = 0;
    let totalSetlistEntriesUpdated = 0;
    let failedOperations = 0;

    // Track which combined songs can be safely deleted
    const songsToDelete = [];

    for (const combinedSong of combinedSongs) {
        console.log('\n' + '='.repeat(80));
        console.log(`\n📀 Processing: "${combinedSong.title}"`);
        console.log(`   Song ID: ${combinedSong.id}`);
        console.log(`   Type: ${combinedSong.is_original ? 'Original' : 'Cover by ' + combinedSong.original_artist}`);

        // Split the title by "/"
        const songTitles = combinedSong.title.split('/').map(t => t.trim());
        console.log(`   Split into ${songTitles.length} songs: ${songTitles.map(t => `"${t}"`).join(', ')}`);

        // Get all setlist entries for this combined song
        const { data: setlistEntries, error: setlistError } = await supabase
            .from('setlist_songs')
            .select(`
                id,
                show_id,
                set_number,
                song_order,
                notes,
                is_encore,
                shows (
                    show_date,
                    venues (name, city, state_country)
                )
            `)
            .eq('song_id', combinedSong.id)
            .order('shows(show_date)', { ascending: false });

        if (setlistError) {
            console.error('   ❌ Error fetching setlist entries:', setlistError);
            continue;
        }

        console.log(`\n   Found ${setlistEntries.length} setlist entries to update:`);
        totalSetlistEntries += setlistEntries.length;

        // Process each individual song title
        const individualSongIds = [];
        let songCreationFailed = false;

        for (let i = 0; i < songTitles.length; i++) {
            let songTitle = songTitles[i];

            // Apply spelling corrections if needed
            if (SONG_TITLE_CORRECTIONS[songTitle]) {
                console.log(`\n   🎵 Song ${i + 1}: "${songTitle}" → "${SONG_TITLE_CORRECTIONS[songTitle]}" (corrected)`);
                songTitle = SONG_TITLE_CORRECTIONS[songTitle];
            } else {
                console.log(`\n   🎵 Song ${i + 1}: "${songTitle}"`);
            }

            // Check if this song already exists
            const { data: existingSongs, error: searchError } = await supabase
                .from('songs')
                .select('id, title')
                .ilike('title', songTitle);

            if (searchError) {
                console.error(`      ❌ Error searching for song:`, searchError);
                continue;
            }

            let songId;

            if (existingSongs && existingSongs.length > 0) {
                // Song already exists
                songId = existingSongs[0].id;
                console.log(`      ✅ Song already exists (ID: ${songId})`);
            } else {
                // Create new song
                console.log(`      🆕 Creating new song...`);
                
                if (!DRY_RUN) {
                    const { data: newSong, error: createError } = await supabase
                        .from('songs')
                        .insert([{
                            title: songTitle,
                            is_original: combinedSong.is_original,
                            original_artist: combinedSong.original_artist,
                            written_by: combinedSong.written_by
                        }])
                        .select()
                        .single();

                    if (createError) {
                        console.error(`      ❌ Error creating song:`, createError);
                        songCreationFailed = true;
                        failedOperations++;
                        break; // Stop processing this combined song
                    }

                    songId = newSong.id;
                    console.log(`      ✅ Created song (ID: ${songId})`);
                    totalSongsCreated++;
                } else {
                    songId = `[DRY-RUN-${songTitle}]`;
                    console.log(`      📝 Would create song "${songTitle}"`);
                }
            }

            individualSongIds.push(songId);
        }

        // Skip processing setlist entries if song creation failed
        if (songCreationFailed) {
            console.log(`\n   ⚠️  Skipping setlist updates due to song creation failure\n`);
            continue;
        }

        // Track if all setlist entries for this song were successfully updated
        let allEntriesSuccessful = true;

        // Process each setlist entry
        for (const entry of setlistEntries) {
            const show = entry.shows;
            const venue = show.venues;
            const date = new Date(show.show_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            console.log(`\n   📅 ${date} - ${venue.name}, ${venue.city}`);
            console.log(`      Set ${entry.set_number}, Song #${entry.song_order}`);
            console.log(`      Setlist Entry ID: ${entry.id}`);

            if (!DRY_RUN) {
                // Step 1: Get all songs in this set that come after the current song
                const { data: laterSongs, error: laterError } = await supabase
                    .from('setlist_songs')
                    .select('id, song_order')
                    .eq('show_id', entry.show_id)
                    .eq('set_number', entry.set_number)
                    .gt('song_order', entry.song_order)
                    .order('song_order', { ascending: false }); // Process in reverse order

                if (laterError) {
                    console.error(`      ❌ Error fetching later songs:`, laterError);
                    allEntriesSuccessful = false;
                    failedOperations++;
                    continue;
                }

                // Step 2: Shift all later songs down by (number of individual songs - 1)
                const shiftAmount = individualSongIds.length - 1;
                
                if (shiftAmount > 0 && laterSongs.length > 0) {
                    console.log(`      📊 Shifting ${laterSongs.length} songs down by ${shiftAmount}...`);
                    
                    for (const laterSong of laterSongs) {
                        const { error: updateError } = await supabase
                            .from('setlist_songs')
                            .update({ song_order: laterSong.song_order + shiftAmount })
                            .eq('id', laterSong.id);

                        if (updateError) {
                            console.error(`      ❌ Error shifting song:`, updateError);
                            allEntriesSuccessful = false;
                            failedOperations++;
                        }
                    }
                }

                // Step 3: Update the original entry to the first song
                console.log(`      🔄 Updating entry to "${songTitles[0]}"...`);
                
                const { error: updateFirstError } = await supabase
                    .from('setlist_songs')
                    .update({
                        song_id: individualSongIds[0],
                        jams_into: individualSongIds.length > 1 ? individualSongIds[1] : null
                    })
                    .eq('id', entry.id);

                if (updateFirstError) {
                    console.error(`      ❌ Error updating first song:`, updateFirstError);
                    allEntriesSuccessful = false;
                    failedOperations++;
                    continue;
                }

                console.log(`      ✅ Updated to "${songTitles[0]}" with jams_into`);
                totalSetlistEntriesUpdated++;

                // Step 4: Insert additional songs
                for (let i = 1; i < individualSongIds.length; i++) {
                    const newSongOrder = entry.song_order + i;
                    const jamsInto = i < individualSongIds.length - 1 ? individualSongIds[i + 1] : null;

                    console.log(`      ➕ Inserting "${songTitles[i]}" at position ${newSongOrder}...`);

                    const { error: insertError } = await supabase
                        .from('setlist_songs')
                        .insert([{
                            show_id: entry.show_id,
                            song_id: individualSongIds[i],
                            set_number: entry.set_number,
                            song_order: newSongOrder,
                            is_encore: entry.is_encore,
                            jams_into: jamsInto
                        }]);

                    if (insertError) {
                        console.error(`      ❌ Error inserting song:`, insertError);
                        allEntriesSuccessful = false;
                        failedOperations++;
                    } else {
                        console.log(`      ✅ Inserted "${songTitles[i]}"`);
                        totalSetlistEntriesUpdated++;
                    }
                }
            } else {
                // Dry run - just show what would happen
                console.log(`      📝 Would update entry to "${songTitles[0]}" with jams_into`);
                for (let i = 1; i < songTitles.length; i++) {
                    console.log(`      📝 Would insert "${songTitles[i]}" at position ${entry.song_order + i}`);
                }
            }
        }

        // Only mark for deletion if ALL entries were successfully updated
        if (!DRY_RUN && allEntriesSuccessful) {
            songsToDelete.push(combinedSong);
            console.log(`\n   ✅ All setlist entries updated successfully - marked for deletion`);
        } else if (!DRY_RUN && !allEntriesSuccessful) {
            console.log(`\n   ⚠️  Some updates failed - NOT deleting combined song to preserve data`);
        }
    }

    // Final step: Delete combined songs (only in execute mode and only if successfully updated)
    if (!DRY_RUN && songsToDelete.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('\n🗑️  SAFE DELETE: Deleting combined songs (all setlist entries already updated)...\n');

        for (const combinedSong of songsToDelete) {
            const { error: deleteError } = await supabase
                .from('songs')
                .delete()
                .eq('id', combinedSong.id);

            if (deleteError) {
                console.error(`   ❌ Error deleting "${combinedSong.title}":`, deleteError);
            } else {
                console.log(`   ✅ Deleted "${combinedSong.title}"`);
            }
        }
    } else if (!DRY_RUN && songsToDelete.length === 0 && combinedSongs.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('\n⚠️  WARNING: No combined songs were deleted due to failed updates');
        console.log('   This preserves data integrity - combined songs remain until all updates succeed\n');
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY:');
    console.log(`   Combined songs processed: ${combinedSongs.length}`);
    console.log(`   Setlist entries affected: ${totalSetlistEntries}`);

    if (!DRY_RUN) {
        console.log(`   New songs created: ${totalSongsCreated}`);
        console.log(`   Setlist entries updated/created: ${totalSetlistEntriesUpdated}`);
        console.log(`   Failed operations: ${failedOperations}`);
        console.log(`   Combined songs deleted: ${songsToDelete.length}`);
        console.log(`   Combined songs preserved (due to errors): ${combinedSongs.length - songsToDelete.length}`);

        if (failedOperations === 0) {
            console.log('\n✅ Cleanup complete! All operations successful.\n');
        } else {
            console.log('\n⚠️  Cleanup complete with warnings - some operations failed');
            console.log('   Combined songs with failed updates were NOT deleted to preserve data\n');
        }
    } else {
        console.log('\n📝 This was a dry run. Run with --execute to apply changes.\n');
    }
}

cleanupCombinedSongs().catch(console.error);

