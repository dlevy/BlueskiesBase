/**
 * Backfill thumbnail_url for existing user_posters/user_photos rows.
 *
 * SAFETY: purely additive. This never touches an existing full-size file —
 * it only downloads it (read-only), derives a small thumbnail, uploads that
 * as a brand-new file, and sets thumbnail_url on the row. If anything here
 * is wrong, the fix is just deleting the generated thumbnail files and
 * re-running; nothing original is ever modified or at risk.
 *
 * - Defaults to DRY RUN. Nothing is written unless you pass --apply.
 * - Idempotent/resumable: rows that already have thumbnail_url are skipped.
 * - Per-row errors are caught and reported; one bad file never aborts the run.
 *
 * Usage:
 *   node scripts/backfill_thumbnails.js                      # dry run, both tables
 *   node scripts/backfill_thumbnails.js --apply
 *   node scripts/backfill_thumbnails.js --apply --limit=5     # smoke test
 *   node scripts/backfill_thumbnails.js --table=user_posters --apply
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { generateThumbnail } = require('../server/utils/imageProcessing');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TABLES = {
    user_posters: { bucket: 'show-posters', urlCol: 'poster_url' },
    user_photos: { bucket: 'show-photos', urlCol: 'photo_url' },
};

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const tableArg = args.find(a => a.startsWith('--table='));
const limitArg = args.find(a => a.startsWith('--limit='));
const TABLE_NAMES = tableArg ? [tableArg.split('=')[1]] : Object.keys(TABLES);
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

if (tableArg && !TABLES[TABLE_NAMES[0]]) {
    console.error(`Unknown table "${TABLE_NAMES[0]}". Valid: ${Object.keys(TABLES).join(', ')}`);
    process.exit(1);
}

function storagePathFromUrl(url, bucket) {
    return url?.split(`/${bucket}/`)[1] || null;
}

async function backfillTable(tableName) {
    const { bucket, urlCol } = TABLES[tableName];
    console.log(`\n=== Table: ${tableName} (bucket: ${bucket}) ===`);

    const { data: rows, error } = await supabase
        .from(tableName)
        .select(`id, ${urlCol}, thumbnail_url`)
        .is('thumbnail_url', null);

    if (error) throw new Error(`select ${tableName} failed: ${error.message}`);
    console.log(`  ${rows.length} row(s) missing a thumbnail`);

    let fixed = 0, failed = 0;
    const failures = [];

    for (const row of rows) {
        if (fixed >= LIMIT) { console.log(`  Reached --limit=${LIMIT}, stopping.`); break; }

        const storagePath = storagePathFromUrl(row[urlCol], bucket);
        if (!storagePath) {
            failed++; failures.push({ id: row.id, error: 'could not derive storage path from url' });
            continue;
        }

        if (!APPLY) {
            console.log(`  [DRY RUN] would generate thumbnail for ${tableName}/${row.id} (${storagePath})`);
            fixed++;
            continue;
        }

        try {
            const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(storagePath);
            if (downloadError) throw new Error(`download failed: ${downloadError.message}`);
            const buffer = Buffer.from(await blob.arrayBuffer());

            const thumb = await generateThumbnail(buffer);
            const dir = storagePath.includes('/') ? storagePath.slice(0, storagePath.lastIndexOf('/')) : '';
            const base = storagePath.slice(storagePath.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
            const thumbPath = `${dir ? dir + '/' : ''}${base}_thumb.${thumb.ext}`;

            const { error: uploadError } = await supabase.storage.from(bucket)
                .upload(thumbPath, thumb.buffer, { contentType: thumb.contentType, upsert: true });
            if (uploadError) throw new Error(`thumbnail upload failed: ${uploadError.message}`);

            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(thumbPath);

            const { error: updateError } = await supabase
                .from(tableName)
                .update({ thumbnail_url: publicUrl })
                .eq('id', row.id)
                .is('thumbnail_url', null); // don't clobber a concurrent write
            if (updateError) throw new Error(`db update failed: ${updateError.message}`);

            fixed++;
            if (fixed % 10 === 0) console.log(`  ...fixed ${fixed} so far`);
        } catch (err) {
            failed++;
            failures.push({ id: row.id, error: err.message });
            console.error(`  FAILED: ${tableName}/${row.id} — ${err.message}`);
        }
    }

    console.log(`  Done: ${APPLY ? 'fixed' : 'would fix'} ${fixed}, failed ${failed}`);
    return { fixed, failed, failures };
}

async function main() {
    console.log(`Mode: ${APPLY ? 'APPLY (will write changes)' : 'DRY RUN (no changes — pass --apply to write)'}`);
    console.log(`Tables: ${TABLE_NAMES.join(', ')}`);
    if (LIMIT !== Infinity) console.log(`Limit: at most ${LIMIT} row(s) per table`);

    let totalFixed = 0, totalFailed = 0;
    const allFailures = [];
    for (const t of TABLE_NAMES) {
        const { fixed, failed, failures } = await backfillTable(t);
        totalFixed += fixed;
        totalFailed += failed;
        failures.forEach(f => allFailures.push({ table: t, ...f }));
    }

    console.log('\n=== Summary ===');
    console.log(`${APPLY ? 'Fixed' : 'Would fix'}: ${totalFixed}`);
    console.log(`Failed: ${totalFailed}`);
    if (allFailures.length > 0) {
        console.log('\nFailures (safe to re-run — already-fixed rows are skipped):');
        allFailures.forEach(f => console.log(`  - ${f.table}/${f.id}: ${f.error}`));
    }
    if (!APPLY && totalFixed > 0) {
        console.log('\nThis was a dry run. Re-run with --apply to actually generate thumbnails.');
        console.log('Tip: try a small batch first, e.g. --apply --limit=5');
    }
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
