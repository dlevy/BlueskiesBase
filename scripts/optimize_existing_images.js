/**
 * Retroactively re-optimize existing FULL-SIZE poster/photo images.
 *
 * UNLIKE backfill_thumbnails.js, this is NOT purely additive — it replaces
 * the full-size image's bytes (new path + DB url update + old file deleted).
 * That makes it a genuinely destructive, hard-to-reverse operation on
 * production data, so this script is deliberately more cautious:
 *
 *   - Defaults to DRY RUN. Nothing is written unless you pass --apply.
 *   - Every original file this touches is backed up to a local directory
 *     BEFORE any write, so the exact original bytes can always be restored
 *     even though the lossless path is verified pixel-identical and the
 *     lossy (JPEG photo) path uses a well-established visually-safe quality.
 *   - MIN_SAVINGS_RATIO gate: skips a file if re-encoding doesn't save at
 *     least this fraction of its size — no point taking any risk for a
 *     marginal or negative "savings".
 *   - Uses upload-to-new-path + DB update + delete-old, mirroring exactly
 *     what a normal "replace" upload already does, rather than overwriting
 *     a path in place — so a crash mid-run leaves the old file intact and
 *     the DB row still pointing at a valid image (never a half-written state).
 *   - Per-row errors are caught and reported; one bad file never aborts the run.
 *
 * Usage:
 *   node scripts/optimize_existing_images.js                    # dry run, both tables
 *   node scripts/optimize_existing_images.js --apply --limit=5   # smoke test
 *   node scripts/optimize_existing_images.js --apply
 *   node scripts/optimize_existing_images.js --table=user_posters --apply
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { optimizeFullImage } = require('../server/utils/imageProcessing');
const fs = require('fs');
const path = require('path');

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

const MIN_SAVINGS_RATIO = 0.10; // skip if re-encoding saves less than 10%
const BACKUP_DIR = path.join(__dirname, '..', '.image-optimize-backups');

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

async function getMimetype(bucket, storagePath) {
    const dir = storagePath.includes('/') ? storagePath.slice(0, storagePath.lastIndexOf('/')) : '';
    const name = storagePath.slice(storagePath.lastIndexOf('/') + 1);
    const { data } = await supabase.storage.from(bucket).list(dir, { search: name });
    return data?.find(f => f.name === name)?.metadata?.mimetype || null;
}

async function optimizeTable(tableName) {
    const { bucket, urlCol } = TABLES[tableName];
    console.log(`\n=== Table: ${tableName} (bucket: ${bucket}) ===`);

    const { data: rows, error } = await supabase.from(tableName).select(`id, ${urlCol}`);
    if (error) throw new Error(`select ${tableName} failed: ${error.message}`);
    console.log(`  ${rows.length} row(s) total`);

    let processed = 0, replaced = 0, skippedSmallSavings = 0, failed = 0;
    let totalOriginalBytes = 0, totalNewBytes = 0;
    const failures = [];

    for (const row of rows) {
        if (processed >= LIMIT) { console.log(`  Reached --limit=${LIMIT}, stopping.`); break; }
        processed++;

        const oldPath = storagePathFromUrl(row[urlCol], bucket);
        if (!oldPath) {
            failed++; failures.push({ id: row.id, error: 'could not derive storage path from url' });
            continue;
        }

        try {
            const mimetype = await getMimetype(bucket, oldPath);
            const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(oldPath);
            if (downloadError) throw new Error(`download failed: ${downloadError.message}`);
            const originalBuffer = Buffer.from(await blob.arrayBuffer());

            const optimized = await optimizeFullImage(originalBuffer, mimetype || blob.type);
            const savingsRatio = 1 - (optimized.buffer.length / originalBuffer.length);

            if (savingsRatio < MIN_SAVINGS_RATIO) {
                skippedSmallSavings++;
                console.log(`  SKIP (only ${(savingsRatio * 100).toFixed(1)}% smaller): ${tableName}/${row.id} (${oldPath})`);
                continue;
            }

            totalOriginalBytes += originalBuffer.length;
            totalNewBytes += optimized.buffer.length;

            console.log(`  ${APPLY ? '' : '[DRY RUN] '}${tableName}/${row.id}: ${originalBuffer.length}B -> ${optimized.buffer.length}B (${(savingsRatio * 100).toFixed(1)}% smaller)`);

            if (!APPLY) { replaced++; continue; }

            // Back up the exact original bytes before any write.
            const backupPath = path.join(BACKUP_DIR, bucket, oldPath);
            fs.mkdirSync(path.dirname(backupPath), { recursive: true });
            fs.writeFileSync(backupPath, originalBuffer);

            const dir = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : '';
            const base = oldPath.slice(oldPath.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
            const newPath = `${dir ? dir + '/' : ''}${base}_opt.${optimized.ext}`;

            const { error: uploadError } = await supabase.storage.from(bucket)
                .upload(newPath, optimized.buffer, { contentType: optimized.contentType, upsert: false });
            if (uploadError) throw new Error(`upload of optimized file failed: ${uploadError.message}`);

            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(newPath);

            const { error: updateError } = await supabase
                .from(tableName)
                .update({ [urlCol]: publicUrl })
                .eq('id', row.id)
                .eq(urlCol, row[urlCol]); // don't clobber a concurrent change
            if (updateError) {
                // Roll back: remove the newly uploaded file so we don't leave an
                // orphan, and leave the old file + DB row exactly as they were.
                await supabase.storage.from(bucket).remove([newPath]);
                throw new Error(`db update failed, rolled back new file: ${updateError.message}`);
            }

            // Verify the new URL actually serves before deleting the original.
            const verifyRes = await fetch(publicUrl);
            const verifyBuf = Buffer.from(await verifyRes.arrayBuffer());
            if (verifyRes.status !== 200 || verifyBuf.length !== optimized.buffer.length) {
                throw new Error(`post-write verification failed (status=${verifyRes.status}, size=${verifyBuf.length} expected=${optimized.buffer.length}) — leaving old file in place`);
            }

            await supabase.storage.from(bucket).remove([oldPath]);
            replaced++;
        } catch (err) {
            failed++;
            failures.push({ id: row.id, error: err.message });
            console.error(`  FAILED: ${tableName}/${row.id} — ${err.message}`);
        }
    }

    console.log(`  Done: ${APPLY ? 'replaced' : 'would replace'} ${replaced}, skipped (low savings) ${skippedSmallSavings}, failed ${failed}`);
    if (totalOriginalBytes > 0) {
        console.log(`  Bytes: ${totalOriginalBytes} -> ${totalNewBytes} (${(100 * (1 - totalNewBytes / totalOriginalBytes)).toFixed(1)}% reduction on affected files)`);
    }
    return { replaced, skippedSmallSavings, failed, failures, totalOriginalBytes, totalNewBytes };
}

async function main() {
    console.log(`Mode: ${APPLY ? 'APPLY (will replace files — originals backed up to ' + BACKUP_DIR + ')' : 'DRY RUN (no changes — pass --apply to write)'}`);
    console.log(`Tables: ${TABLE_NAMES.join(', ')}`);
    console.log(`Minimum savings to bother: ${(MIN_SAVINGS_RATIO * 100).toFixed(0)}%`);
    if (LIMIT !== Infinity) console.log(`Limit: at most ${LIMIT} row(s) per table`);

    let totalReplaced = 0, totalFailed = 0, totalOrig = 0, totalNew = 0;
    const allFailures = [];
    for (const t of TABLE_NAMES) {
        const r = await optimizeTable(t);
        totalReplaced += r.replaced;
        totalFailed += r.failed;
        totalOrig += r.totalOriginalBytes;
        totalNew += r.totalNewBytes;
        r.failures.forEach(f => allFailures.push({ table: t, ...f }));
    }

    console.log('\n=== Summary ===');
    console.log(`${APPLY ? 'Replaced' : 'Would replace'}: ${totalReplaced}`);
    console.log(`Failed: ${totalFailed}`);
    if (totalOrig > 0) {
        console.log(`Total bytes: ${totalOrig} -> ${totalNew} (${(100 * (1 - totalNew / totalOrig)).toFixed(1)}% reduction)`);
    }
    if (allFailures.length > 0) {
        console.log('\nFailures:');
        allFailures.forEach(f => console.log(`  - ${f.table}/${f.id}: ${f.error}`));
    }
    if (!APPLY && totalReplaced > 0) {
        console.log('\nThis was a dry run. Re-run with --apply to actually replace these files.');
        console.log(`Originals will be backed up to ${BACKUP_DIR} before anything is overwritten.`);
    }
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
