require('dotenv').config();
const { supabase } = require('../server/config/supabase');

async function runMigration() {
    console.log('🚀 Running albums table migration...\n');
    console.log('⚠️  NOTE: You need to run the SQL migration in Supabase Dashboard first!\n');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Copy the contents of scripts/migrations/add_albums_table.sql');
    console.log('   3. Paste and run the SQL\n');
    console.log('   This script will verify the migration was successful.\n');

    try {

        // Verify the migration
        console.log('🔍 Verifying migration...\n');

        // Check if albums table exists and has data
        const { data: albums, error: albumsError } = await supabase
            .from('albums')
            .select('*')
            .order('release_date');

        if (albumsError) {
            console.error('❌ Error fetching albums:', albumsError);
        } else {
            console.log(`✅ Albums table created with ${albums.length} albums:`);
            albums.forEach(album => {
                console.log(`   - ${album.title} (${album.release_date}) [${album.album_type}]`);
            });
        }

        // Check if album_id column was added to songs
        const { data: songs, error: songsError } = await supabase
            .from('songs')
            .select('id, title, album_id')
            .limit(5);

        if (songsError) {
            console.error('❌ Error fetching songs:', songsError);
        } else {
            console.log(`\n✅ Songs table updated - album_id column added`);
            console.log(`   Sample songs (album_id should be null for now):`);
            songs.forEach(song => {
                console.log(`   - ${song.title}: album_id = ${song.album_id || 'null'}`);
            });
        }

        console.log('\n🎉 Migration verification complete!\n');
        console.log('📋 Next steps:');
        console.log('   1. Update admin panel to allow associating songs with albums');
        console.log('   2. Manually assign albums to original songs');
        console.log('   3. Add album breakdown stats to show/tour views\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

runMigration();

