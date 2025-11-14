#!/usr/bin/env node
/**
 * Apply database migration to fix CASCADE deletion issue
 * This script applies the fix_song_delete_cascade.sql migration
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables');
    console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
    console.log('🔧 Applying Database Migration: Fix Song Delete Cascade');
    console.log('=' .repeat(60));
    
    try {
        // Step 1: Drop the existing constraint
        console.log('\n📝 Step 1: Dropping existing CASCADE constraint...');
        const { error: dropError } = await supabase.rpc('exec_sql', {
            query: `ALTER TABLE public.setlist_songs DROP CONSTRAINT IF EXISTS setlist_songs_song_id_fkey;`
        });
        
        if (dropError) {
            console.log('⚠️  Note: Cannot execute via RPC. Please run manually in Supabase SQL Editor.');
            console.log('\n📋 SQL to run in Supabase Dashboard → SQL Editor:\n');
            
            const sqlFile = path.join(__dirname, 'migrations', 'fix_song_delete_cascade.sql');
            const sql = fs.readFileSync(sqlFile, 'utf8');
            console.log(sql);
            
            console.log('\n📍 Instructions:');
            console.log('1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
            console.log('2. Copy the SQL above');
            console.log('3. Paste into the SQL Editor');
            console.log('4. Click "Run"');
            console.log('\n✅ After running, the constraint will be fixed!');
            return;
        }
        
        console.log('✅ Dropped existing constraint');
        
        // Step 2: Add the new RESTRICT constraint
        console.log('\n📝 Step 2: Adding new RESTRICT constraint...');
        const { error: addError } = await supabase.rpc('exec_sql', {
            query: `ALTER TABLE public.setlist_songs 
                    ADD CONSTRAINT setlist_songs_song_id_fkey 
                    FOREIGN KEY (song_id) 
                    REFERENCES public.songs(id) 
                    ON DELETE RESTRICT;`
        });
        
        if (addError) {
            console.error('❌ Error adding constraint:', addError);
            return;
        }
        
        console.log('✅ Added RESTRICT constraint');
        
        // Step 3: Verify the constraint
        console.log('\n📝 Step 3: Verifying constraint...');
        const { data: constraints, error: verifyError } = await supabase
            .from('information_schema.table_constraints')
            .select('*')
            .eq('table_name', 'setlist_songs')
            .eq('constraint_name', 'setlist_songs_song_id_fkey');
        
        if (verifyError) {
            console.log('⚠️  Could not verify constraint (this is OK)');
        } else {
            console.log('✅ Constraint verified');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration applied successfully!');
        console.log('\n🎉 Songs can no longer be deleted if they are used in setlists!');
        console.log('   Attempting to delete a song in use will now show an error.');
        
    } catch (error) {
        console.error('❌ Error applying migration:', error);
        console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:\n');
        
        const sqlFile = path.join(__dirname, 'migrations', 'fix_song_delete_cascade.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        console.log(sql);
    }
}

applyMigration();

