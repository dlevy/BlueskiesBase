/**
 * Migrate Supabase Storage files from old project to new project.
 *
 * Usage:
 *   node scripts/migrate-storage.js <path-to-extracted-zip>
 *
 * Example:
 *   node scripts/migrate-storage.js "C:\Users\info\Desktop\sxkonriiudchfhkrrait.storage"
 *
 * The extracted directory should contain bucket folders, e.g.:
 *   show-photos/
 *     userId/showId/filename.jpg
 *   show-posters/
 *     userId/showId/filename.jpg
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const OLD_URL = 'https://sxkonriiudchfhkrrait.supabase.co';
const NEW_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!NEW_URL || !SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(NEW_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const BUCKETS = ['show-photos', 'show-posters'];

async function ensureBucketExists(bucketName) {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === bucketName);
    if (!exists) {
        const { error } = await supabase.storage.createBucket(bucketName, { public: true });
        if (error) throw new Error(`Failed to create bucket ${bucketName}: ${error.message}`);
        console.log(`  Created bucket: ${bucketName}`);
    } else {
        console.log(`  Bucket already exists: ${bucketName}`);
    }
}

function walkDir(dir, fileList = []) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath, fileList);
        } else {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

function guessMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic',
        '.pdf': 'application/pdf'
    };
    return map[ext] || 'application/octet-stream';
}

async function uploadBucket(storageRoot, bucketName) {
    const bucketDir = path.join(storageRoot, bucketName);
    if (!fs.existsSync(bucketDir)) {
        console.log(`  No directory found for bucket: ${bucketName}, skipping.`);
        return 0;
    }

    const files = walkDir(bucketDir);
    console.log(`  Found ${files.length} files to upload to ${bucketName}`);

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const filePath of files) {
        const relativePath = path.relative(bucketDir, filePath).replace(/\\/g, '/');
        const fileBuffer = fs.readFileSync(filePath);
        const contentType = guessMimeType(filePath);

        const { error } = await supabase.storage
            .from(bucketName)
            .upload(relativePath, fileBuffer, { contentType, upsert: true });

        if (error) {
            if (error.message?.includes('already exists')) {
                skipped++;
            } else {
                console.error(`    FAILED: ${relativePath} — ${error.message}`);
                failed++;
            }
        } else {
            uploaded++;
            if (uploaded % 10 === 0) console.log(`    Uploaded ${uploaded}/${files.length}...`);
        }
    }

    console.log(`  Done: ${uploaded} uploaded, ${skipped} already existed, ${failed} failed`);
    return uploaded + skipped;
}

async function updateDatabaseUrls() {
    console.log('\nUpdating photo_url in user_photos...');
    const { data: photos, error: fetchErr } = await supabase
        .from('user_photos')
        .select('id, photo_url')
        .like('photo_url', `${OLD_URL}%`);

    if (fetchErr) {
        console.error('  Failed to fetch photos:', fetchErr.message);
        return;
    }

    console.log(`  Found ${photos?.length || 0} photo URLs to update`);

    for (const photo of (photos || [])) {
        const newUrl = photo.photo_url.replace(OLD_URL, NEW_URL);
        const { error } = await supabase
            .from('user_photos')
            .update({ photo_url: newUrl })
            .eq('id', photo.id);
        if (error) console.error(`  Failed to update photo ${photo.id}:`, error.message);
    }
    console.log('  Photo URLs updated.');

    console.log('\nUpdating poster_url in user_posters...');
    const { data: posters, error: posterFetchErr } = await supabase
        .from('user_posters')
        .select('id, poster_url')
        .like('poster_url', `${OLD_URL}%`);

    if (posterFetchErr) {
        console.error('  Failed to fetch posters:', posterFetchErr.message);
        return;
    }

    console.log(`  Found ${posters?.length || 0} poster URLs to update`);

    for (const poster of (posters || [])) {
        const newUrl = poster.poster_url.replace(OLD_URL, NEW_URL);
        const { error } = await supabase
            .from('user_posters')
            .update({ poster_url: newUrl })
            .eq('id', poster.id);
        if (error) console.error(`  Failed to update poster ${poster.id}:`, error.message);
    }
    console.log('  Poster URLs updated.');
}

async function main() {
    const storageRoot = process.argv[2];
    if (!storageRoot) {
        console.error('Usage: node scripts/migrate-storage.js <path-to-extracted-zip-folder>');
        process.exit(1);
    }

    if (!fs.existsSync(storageRoot)) {
        console.error(`Directory not found: ${storageRoot}`);
        process.exit(1);
    }

    console.log(`Migrating storage from: ${storageRoot}`);
    console.log(`Target Supabase project: ${NEW_URL}\n`);

    for (const bucket of BUCKETS) {
        console.log(`\n=== Bucket: ${bucket} ===`);
        await ensureBucketExists(bucket);
        await uploadBucket(storageRoot, bucket);
    }

    await updateDatabaseUrls();

    console.log('\nMigration complete!');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
