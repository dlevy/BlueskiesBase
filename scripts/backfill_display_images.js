/**
 * Backfill display_url (the 1200px display copy) for existing
 * user_posters/user_photos rows. Requires
 * scripts/migrations/add_image_display_url.sql to have been run first.
 *
 * SAFETY: purely additive, same as backfill_thumbnails.js. Originals are only
 * downloaded (read-only); a new "<name>_display.webp" file is uploaded next to
 * each one and display_url is set on the row. Nothing original is modified.
 *
 * - Defaults to DRY RUN: downloads each original and builds its display copy
 *   in memory to report the real size savings, but uploads/writes nothing.
 * - Idempotent/resumable: rows that already have display_url are skipped.
 * - Per-row errors are caught and reported; one bad file never aborts the run.
 *
 * Usage:
 *   node scripts/backfill_display_images.js                    # dry run
 *   node scripts/backfill_display_images.js --apply --limit=5  # smoke test
 *   node scripts/backfill_display_images.js --apply
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { generateDisplayImage } = require('../server/utils/imageProcessing');

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
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const CONCURRENCY = 4;

const kb = n => `${Math.round(n / 1024).toLocaleString()} KB`;

async function processRow(tableName, row) {
    const { bucket, urlCol } = TABLES[tableName];
    const storagePath = row[urlCol]?.split(`/${bucket}/`)[1];
    if (!storagePath) throw new Error('could not derive storage path from url');

    const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(storagePath);
    if (downloadError) throw new Error(`download failed: ${downloadError.message}`);
    const buffer = Buffer.from(await blob.arrayBuffer());
    const display = await generateDisplayImage(buffer);

    if (APPLY) {
        const displayPath = `${storagePath.replace(/\.[^./]+$/, '')}_display.${display.ext}`;
        const { error: uploadError } = await supabase.storage.from(bucket)
            .upload(displayPath, display.buffer, { contentType: display.contentType, upsert: true });
        if (uploadError) throw new Error(`upload failed: ${uploadError.message}`);
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(displayPath);
        const { error: updateError } = await supabase.from(tableName)
            .update({ display_url: publicUrl })
            .eq('id', row.id)
            .is('display_url', null); // don't clobber a concurrent upload's value
        if (updateError) throw new Error(`db update failed: ${updateError.message}`);
    }
    return { before: buffer.length, after: display.buffer.length };
}

async function backfillTable(tableName) {
    const { urlCol } = TABLES[tableName];
    let { data: rows, error } = await supabase
        .from(tableName)
        .select(`id, ${urlCol}, display_url`)
        .is('display_url', null)
        .order('id');
    // A dry run still works before the migration has added the column — it
    // just treats every row as missing one.
    if (error && !APPLY && /display_url/.test(error.message)) {
        console.log(`  (display_url column not added yet — dry run covers every row)`);
        ({ data: rows, error } = await supabase.from(tableName).select(`id, ${urlCol}`).order('id'));
    }
    if (error) throw new Error(`select ${tableName} failed: ${error.message}`);

    const todo = rows.slice(0, LIMIT);
    console.log(`\n=== ${tableName}: ${rows.length} row(s) missing display_url${todo.length < rows.length ? `, processing ${todo.length}` : ''}`);

    let before = 0, after = 0, done = 0;
    const failures = [];
    for (let i = 0; i < todo.length; i += CONCURRENCY) {
        const batch = todo.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(batch.map(r => processRow(tableName, r)));
        results.forEach((r, j) => {
            if (r.status === 'fulfilled') { before += r.value.before; after += r.value.after; done++; }
            else { failures.push({ id: batch[j].id, error: r.reason.message }); console.error(`  FAILED ${tableName}/${batch[j].id}: ${r.reason.message}`); }
        });
        if (done && done % 40 < CONCURRENCY) console.log(`  ...${done} done`);
    }
    console.log(`  ${APPLY ? 'Created' : 'Would create'} ${done}; failed ${failures.length}`);
    if (done) console.log(`  Originals ${kb(before)} → display copies ${kb(after)} (avg ${kb(before / done)} → ${kb(after / done)}, ${Math.round(100 - (after / before) * 100)}% smaller)`);
    return failures;
}

(async () => {
    console.log(`Mode: ${APPLY ? 'APPLY (uploads files, sets display_url)' : 'DRY RUN (nothing written — pass --apply)'}`);
    const failures = [];
    for (const t of Object.keys(TABLES)) failures.push(...(await backfillTable(t)).map(f => ({ table: t, ...f })));
    if (failures.length) {
        console.log('\nFailures (safe to re-run — finished rows are skipped):');
        failures.forEach(f => console.log(`  - ${f.table}/${f.id}: ${f.error}`));
    }
})().catch(err => { console.error('Fatal:', err); process.exit(1); });
