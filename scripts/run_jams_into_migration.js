require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
    console.log('\n🔄 Running jams_into migration...\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'migrations', 'update_jams_into_to_uuid.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 SQL to execute:');
    console.log('─'.repeat(80));
    console.log(sql);
    console.log('─'.repeat(80));
    console.log('\n⚠️  This will drop the existing jams_into boolean column and recreate it as UUID.');
    console.log('⚠️  Any existing jams_into data will be lost (but it was just true/false anyway).\n');

    // Note: Supabase JS client doesn't support raw SQL execution directly
    // You need to run this in the Supabase SQL Editor
    console.log('📋 INSTRUCTIONS:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL above');
    console.log('4. Click "Run" to execute the migration');
    console.log('\nOR run this SQL file directly in your database client.\n');
}

runMigration().catch(console.error);

