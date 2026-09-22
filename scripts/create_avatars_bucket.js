/**
 * One-off: create the `avatars` Supabase Storage bucket (public), used by the
 * profile-page feature. Run once: node scripts/create_avatars_bucket.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw new Error(`Failed to list buckets: ${listError.message}`);

    const exists = buckets?.some(b => b.name === 'avatars');
    if (exists) {
        console.log('Bucket already exists: avatars');
        return;
    }

    const { error } = await supabase.storage.createBucket('avatars', { public: true });
    if (error) throw new Error(`Failed to create bucket avatars: ${error.message}`);
    console.log('Created bucket: avatars');
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
