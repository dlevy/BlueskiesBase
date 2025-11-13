require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findShow() {
    try {
        // Find shows at Red Rocks in September
        const { data: shows, error } = await supabase
            .from('shows')
            .select('id, show_date, venues(name, city)')
            .ilike('venues.name', '%Red Rocks%')
            .gte('show_date', '2024-09-01')
            .lte('show_date', '2024-09-30')
            .order('show_date');

        if (error) {
            console.error('Error:', error);
            return;
        }

        console.log('\n🎸 Red Rocks shows in September 2024:\n');
        
        for (const show of shows) {
            console.log(`Date: ${show.show_date}`);
            console.log(`ID: ${show.id}`);
            console.log(`Venue: ${show.venues?.name}, ${show.venues?.city}`);
            
            // Check if it has setlist
            const { count } = await supabase
                .from('setlist_songs')
                .select('id', { count: 'exact', head: true })
                .eq('show_id', show.id);
            
            console.log(`Setlist: ${count || 0} songs`);
            console.log('');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

findShow();

