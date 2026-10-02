const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabaseAdmin } = require('../config/supabase');
const { requireEditorOrAdmin, requireAdmin } = require('../middleware/requireRole');

const MEMBER_PHOTOS_BUCKET = 'band-member-photos';
const GEAR_PHOTOS_BUCKET = 'gear-photos';
const VALID_CATEGORIES = ['guitar', 'bass', 'amp', 'pedal', 'drums', 'keys', 'vocals_mic', 'other'];

const uploadPhoto = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit, same as avatars/posters/photos
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    },
});

// Removes the old file at `url` from `bucket` (if any), used before replacing
// a photo — same pattern as the avatar upload route in server/routes/users.js.
async function removeOldPhoto(bucket, url) {
    if (!url) return;
    const oldPath = url.split(`/${bucket}/`)[1];
    if (oldPath) {
        await supabaseAdmin.storage.from(bucket).remove([oldPath]);
    }
}

async function uploadPhotoToBucket(bucket, idForPath, file) {
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${idForPath}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
    return publicUrl;
}

/**
 * GET /api/band-members
 * Public. Every band member with their tenures and gear embedded — the
 * client derives "current" (any tenure/gear with a null end_date) and sorts,
 * same idiom as PostersSection.jsx deriving regularPoster/additionalPosters
 * from flat boolean columns in JS rather than in SQL.
 */
router.get('/', async (req, res) => {
    try {
        const { data: members, error } = await supabaseAdmin
            .from('band_members')
            .select(`
                id, name, photo_url, bio, roles, created_at,
                band_member_tenures ( id, start_date, end_date ),
                gear_items ( id, category, make, model, year, notes, photo_url, start_date, end_date )
            `)
            .order('name');

        if (error) {
            console.error('[GET /band-members] Error:', error);
            return res.status(500).json({ error: 'Failed to fetch band members' });
        }

        res.json({ members: members || [] });
    } catch (error) {
        console.error('Error in GET /band-members:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/band-members/:id
 * Public. Single member with tenures and gear, for the admin edit form.
 */
router.get('/:id', async (req, res) => {
    try {
        const { data: member, error } = await supabaseAdmin
            .from('band_members')
            .select(`
                id, name, photo_url, bio, roles, created_at,
                band_member_tenures ( id, start_date, end_date ),
                gear_items ( id, category, make, model, year, notes, photo_url, start_date, end_date )
            `)
            .eq('id', req.params.id)
            .single();

        if (error || !member) {
            return res.status(404).json({ error: 'Band member not found' });
        }

        res.json({ member });
    } catch (error) {
        console.error('Error in GET /band-members/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/band-members
 * Editor or admin. Create a member (base fields only — tenures and gear are
 * added afterward once the member has an id, same shape as a show existing
 * before its setlist can be edited).
 * Body: { name, bio?, roles? }
 */
router.post('/', requireEditorOrAdmin, async (req, res) => {
    try {
        const { name, bio, roles } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const { data: member, error } = await supabaseAdmin
            .from('band_members')
            .insert({ name: name.trim(), bio: bio || null, roles: Array.isArray(roles) ? roles : [] })
            .select()
            .single();

        if (error) {
            console.error('[POST /band-members] Error:', error);
            return res.status(500).json({ error: 'Failed to create band member' });
        }

        res.status(201).json({ member });
    } catch (error) {
        console.error('Error in POST /band-members:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/band-members/:id
 * Editor or admin. Update name/bio/roles.
 */
router.put('/:id', requireEditorOrAdmin, async (req, res) => {
    try {
        const { name, bio, roles } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const { data: member, error } = await supabaseAdmin
            .from('band_members')
            .update({ name: name.trim(), bio: bio || null, roles: Array.isArray(roles) ? roles : [] })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            console.error('[PUT /band-members/:id] Error:', error);
            return res.status(500).json({ error: 'Failed to update band member' });
        }

        res.json({ member });
    } catch (error) {
        console.error('Error in PUT /band-members/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/band-members/:id
 * Admin only (matches delete being admin-only everywhere else). ON DELETE
 * CASCADE removes the tenure/gear rows, but has no hook into Storage — the
 * member's own photo and every one of their gear photos must be deleted
 * explicitly first, or the bucket accumulates orphaned images forever.
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: member } = await supabaseAdmin
            .from('band_members')
            .select('photo_url, gear_items ( photo_url )')
            .eq('id', id)
            .single();

        if (member) {
            await removeOldPhoto(MEMBER_PHOTOS_BUCKET, member.photo_url);
            for (const gear of member.gear_items || []) {
                await removeOldPhoto(GEAR_PHOTOS_BUCKET, gear.photo_url);
            }
        }

        const { error } = await supabaseAdmin.from('band_members').delete().eq('id', id);
        if (error) {
            console.error('[DELETE /band-members/:id] Error:', error);
            return res.status(500).json({ error: 'Failed to delete band member' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /band-members/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/band-members/:id/photo
 * Editor or admin. Upload/replace a member's photo — mirrors the avatar
 * upload route in server/routes/users.js.
 */
router.post('/:id/photo', requireEditorOrAdmin, uploadPhoto.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { data: existing } = await supabaseAdmin.from('band_members').select('photo_url').eq('id', id).single();
        await removeOldPhoto(MEMBER_PHOTOS_BUCKET, existing?.photo_url);

        let publicUrl;
        try {
            publicUrl = await uploadPhotoToBucket(MEMBER_PHOTOS_BUCKET, id, req.file);
        } catch (uploadError) {
            console.error('[POST /band-members/:id/photo] Storage error:', uploadError);
            return res.status(500).json({ error: 'Failed to upload photo' });
        }

        const { error: updateError } = await supabaseAdmin
            .from('band_members')
            .update({ photo_url: publicUrl })
            .eq('id', id);
        if (updateError) {
            console.error('[POST /band-members/:id/photo] DB update error:', updateError);
            return res.status(500).json({ error: 'Failed to save photo' });
        }

        res.json({ photoUrl: publicUrl });
    } catch (error) {
        console.error('Error in POST /band-members/:id/photo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/band-members/:id/tenures
 * Editor or admin. Delete-all/insert-all replace for this member's tenure
 * rows — same shape as PUT /api/shows/:id/setlist. Plain date pairs, no
 * files, so a bulk replace is safe (unlike gear, which carries photos).
 * Body: { tenures: [{ start_date, end_date? }, ...] }
 */
router.put('/:id/tenures', requireEditorOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { tenures } = req.body;

        if (!Array.isArray(tenures)) {
            return res.status(400).json({ error: 'tenures must be an array' });
        }
        for (const [index, t] of tenures.entries()) {
            if (!t.start_date) {
                return res.status(400).json({ error: `Tenure ${index + 1}: start_date is required` });
            }
            if (t.end_date && t.end_date < t.start_date) {
                return res.status(400).json({ error: `Tenure ${index + 1}: end date can't be before start date` });
            }
        }

        const { error: deleteError } = await supabaseAdmin.from('band_member_tenures').delete().eq('band_member_id', id);
        if (deleteError) {
            console.error('[PUT /band-members/:id/tenures] Error clearing old tenures:', deleteError);
            return res.status(500).json({ error: 'Failed to save tenures' });
        }

        if (tenures.length === 0) {
            return res.json({ tenures: [] });
        }

        const rows = tenures.map(t => ({ band_member_id: id, start_date: t.start_date, end_date: t.end_date || null }));
        const { data: inserted, error: insertError } = await supabaseAdmin
            .from('band_member_tenures')
            .insert(rows)
            .select();

        if (insertError) {
            // Most likely the "one current tenure" partial unique index —
            // surface it as a clean 400 rather than a raw 500.
            if (insertError.code === '23505') {
                return res.status(400).json({ error: 'Only one tenure period can be currently active (end date left blank) at a time' });
            }
            console.error('[PUT /band-members/:id/tenures] Error inserting tenures:', insertError);
            return res.status(500).json({ error: 'Failed to save tenures' });
        }

        res.json({ tenures: inserted });
    } catch (error) {
        console.error('Error in PUT /band-members/:id/tenures:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/band-members/:id/gear
 * Editor or admin. Create one gear item, photo optional. Gear gets its own
 * individual CRUD (not a bulk replace like tenures) because each row can
 * carry a photo file — a bulk delete-all/insert-all can't express "this
 * row's photo didn't change" without re-uploading every photo every save.
 * Multipart body: category, make?, model?, year?, notes?, start_date?, end_date?, photo?
 */
router.post('/:id/gear', requireEditorOrAdmin, uploadPhoto.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        const { category, make, model, year, notes, start_date, end_date } = req.body;

        if (!VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
        }
        if (start_date && end_date && end_date < start_date) {
            return res.status(400).json({ error: "End date can't be before start date" });
        }

        let photoUrl = null;
        if (req.file) {
            try {
                photoUrl = await uploadPhotoToBucket(GEAR_PHOTOS_BUCKET, id, req.file);
            } catch (uploadError) {
                console.error('[POST /band-members/:id/gear] Storage error:', uploadError);
                return res.status(500).json({ error: 'Failed to upload photo' });
            }
        }

        const { data: gear, error } = await supabaseAdmin
            .from('gear_items')
            .insert({
                band_member_id: id,
                category,
                make: make || null,
                model: model || null,
                year: year ? parseInt(year, 10) : null,
                notes: notes || null,
                photo_url: photoUrl,
                start_date: start_date || null,
                end_date: end_date || null,
            })
            .select()
            .single();

        if (error) {
            console.error('[POST /band-members/:id/gear] Error:', error);
            if (photoUrl) await removeOldPhoto(GEAR_PHOTOS_BUCKET, photoUrl);
            return res.status(500).json({ error: 'Failed to create gear item' });
        }

        res.status(201).json({ gear });
    } catch (error) {
        console.error('Error in POST /band-members/:id/gear:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/band-members/gear/:gearId
 * Editor or admin. Update one gear item; replacing the photo deletes the old
 * Storage file first, same as the avatar/poster pattern.
 */
router.put('/gear/:gearId', requireEditorOrAdmin, uploadPhoto.single('photo'), async (req, res) => {
    try {
        const { gearId } = req.params;
        const { category, make, model, year, notes, start_date, end_date } = req.body;

        if (!VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
        }
        if (start_date && end_date && end_date < start_date) {
            return res.status(400).json({ error: "End date can't be before start date" });
        }

        const update = {
            category,
            make: make || null,
            model: model || null,
            year: year ? parseInt(year, 10) : null,
            notes: notes || null,
            start_date: start_date || null,
            end_date: end_date || null,
        };

        if (req.file) {
            const { data: existing } = await supabaseAdmin.from('gear_items').select('photo_url').eq('id', gearId).single();
            await removeOldPhoto(GEAR_PHOTOS_BUCKET, existing?.photo_url);
            try {
                update.photo_url = await uploadPhotoToBucket(GEAR_PHOTOS_BUCKET, gearId, req.file);
            } catch (uploadError) {
                console.error('[PUT /band-members/gear/:gearId] Storage error:', uploadError);
                return res.status(500).json({ error: 'Failed to upload photo' });
            }
        }

        const { data: gear, error } = await supabaseAdmin
            .from('gear_items')
            .update(update)
            .eq('id', gearId)
            .select()
            .single();

        if (error) {
            console.error('[PUT /band-members/gear/:gearId] Error:', error);
            return res.status(500).json({ error: 'Failed to update gear item' });
        }

        res.json({ gear });
    } catch (error) {
        console.error('Error in PUT /band-members/gear/:gearId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/band-members/gear/:gearId
 * Admin only (matches delete being admin-only everywhere else).
 */
router.delete('/gear/:gearId', requireAdmin, async (req, res) => {
    try {
        const { gearId } = req.params;

        const { data: gear } = await supabaseAdmin.from('gear_items').select('photo_url').eq('id', gearId).single();
        await removeOldPhoto(GEAR_PHOTOS_BUCKET, gear?.photo_url);

        const { error } = await supabaseAdmin.from('gear_items').delete().eq('id', gearId);
        if (error) {
            console.error('[DELETE /band-members/gear/:gearId] Error:', error);
            return res.status(500).json({ error: 'Failed to delete gear item' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /band-members/gear/:gearId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
