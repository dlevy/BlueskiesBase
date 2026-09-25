const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase, supabaseAdmin } = require('../config/supabase');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

/**
 * Middleware to verify authentication
 */
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
};

// ============================================
// USER POSTERS ENDPOINTS
// ============================================

/**
 * GET /api/posters
 * Every show poster, each with its show's date/artist/venue/tour — for the public
 * Posters gallery page. Public, no auth required (same as GET /show/:showId).
 * Sorted newest show first in JS rather than via PostgREST's foreignTable ordering —
 * the poster count is small (a few dozen) so there's no real cost to it, and it avoids
 * depending on ordering-by-embedded-column syntax this route doesn't otherwise need.
 */
router.get('/', async (req, res) => {
    try {
        const { data: posters, error } = await supabaseAdmin
            .from('user_posters')
            .select(`
                id,
                poster_url,
                caption,
                is_foil,
                created_at,
                shows (
                    id,
                    show_date,
                    artist_name,
                    tour_name,
                    venues ( name, city, state_country )
                )
            `);

        if (error) {
            console.error('Error fetching posters:', error);
            return res.status(500).json({ error: 'Failed to fetch posters' });
        }

        // A poster whose show has since been deleted would embed shows as null —
        // exclude it rather than ship a gallery tile with nothing to link to.
        const withShow = (posters || []).filter(p => p.shows);
        withShow.sort((a, b) => b.shows.show_date.localeCompare(a.shows.show_date));

        res.json({ posters: withShow });
    } catch (error) {
        console.error('Error in GET /api/posters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/posters/show/:showId
 * Both poster variants for a specific show (regular and/or foil — either, both,
 * or neither may exist). Response: { posters: [...] }, at most one entry per
 * is_foil value.
 */
router.get('/show/:showId', async (req, res) => {
    try {
        const { showId } = req.params;

        const { data: posters, error } = await supabaseAdmin
            .from('user_posters')
            .select(`
                *,
                profiles:user_id (
                    id,
                    username,
                    display_name
                )
            `)
            .eq('show_id', showId)
            .order('is_foil');

        if (error) {
            console.error('Error fetching posters:', error);
            return res.status(500).json({ error: 'Failed to fetch posters' });
        }

        res.json({ posters: posters || [] });
    } catch (error) {
        console.error('Error in GET /api/posters/show/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/posters/upload
 * Upload a poster for a show (replaces the existing poster of the same variant,
 * if any). Body/form field is_foil ('true'/'false', default false) picks which
 * of the show's two possible variants this upload is for — a show can have one
 * regular and one foil poster, uploaded/replaced independently.
 */
router.post('/upload', authenticate, upload.single('poster'), async (req, res) => {
    try {
        const { show_id, caption } = req.body;
        const isFoil = req.body.is_foil === 'true' || req.body.is_foil === true;
        const userId = req.user.id;
        const file = req.file;

        if (!show_id) {
            return res.status(400).json({ error: 'show_id is required' });
        }

        if (!file) {
            return res.status(400).json({ error: 'No poster file provided' });
        }

        // Check if a poster of this same variant already exists for this show —
        // the regular and foil editions are replaced independently.
        const { data: existingPoster } = await supabaseAdmin
            .from('user_posters')
            .select('id, poster_url, user_id')
            .eq('show_id', show_id)
            .eq('is_foil', isFoil)
            .single();

        // If poster exists and user is not the owner, check if user is admin
        if (existingPoster && existingPoster.user_id !== userId) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('is_admin')
                .eq('id', userId)
                .single();

            if (!profile?.is_admin) {
                return res.status(403).json({ error: 'A poster already exists for this show. Only admins can replace it.' });
            }
        }

        // Generate unique filename
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${userId}/${show_id}/${Date.now()}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('show-posters')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error('Error uploading poster:', uploadError);
            return res.status(500).json({ error: 'Failed to upload poster' });
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('show-posters')
            .getPublicUrl(fileName);

        // If poster exists, delete old file and update record
        if (existingPoster) {
            // Extract old file path from URL
            const oldFileName = existingPoster.poster_url.split('/show-posters/')[1];
            if (oldFileName) {
                await supabaseAdmin.storage.from('show-posters').remove([oldFileName]);
            }

            // Update existing poster record
            const { data: poster, error: dbError } = await supabaseAdmin
                .from('user_posters')
                .update({
                    user_id: userId,
                    poster_url: publicUrl,
                    caption: caption || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingPoster.id)
                .select(`
                    *,
                    profiles:user_id (
                        id,
                        username,
                        display_name
                    )
                `)
                .single();

            if (dbError) {
                console.error('Error updating poster record:', dbError);
                await supabaseAdmin.storage.from('show-posters').remove([fileName]);
                return res.status(500).json({ error: 'Failed to update poster record' });
            }

            return res.json({ poster });
        }

        // Create new poster record
        const { data: poster, error: dbError } = await supabaseAdmin
            .from('user_posters')
            .insert({
                user_id: userId,
                show_id,
                poster_url: publicUrl,
                caption: caption || null,
                is_foil: isFoil
            })
            .select(`
                *,
                profiles:user_id (
                    id,
                    username,
                    display_name
                )
            `)
            .single();

        if (dbError) {
            console.error('Error saving poster record:', dbError);
            // Try to delete the uploaded file
            await supabaseAdmin.storage.from('show-posters').remove([fileName]);
            return res.status(500).json({ error: 'Failed to save poster record' });
        }

        res.json({ poster });
    } catch (error) {
        console.error('Error in POST /api/posters/upload:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// POSTER COLLECTION ENDPOINTS
// (which show posters a user owns — foil vs. regular is a property of which
// poster they picked, via user_posters.is_foil, not tracked separately here)
// ============================================

/**
 * GET /api/posters/collection
 * The logged-in user's own poster collection, each entry joined with the poster
 * (and its show) it refers to. Requires authentication.
 */
router.get('/collection', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_poster_collection')
            .select(`
                id,
                created_at,
                user_posters (
                    id,
                    poster_url,
                    is_foil,
                    shows (
                        id,
                        show_date,
                        artist_name,
                        tour_name,
                        venues ( name, city, state_country )
                    )
                )
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching poster collection:', error);
            return res.status(500).json({ error: 'Failed to fetch poster collection' });
        }

        res.json({ collection: data || [] });
    } catch (error) {
        console.error('Error in GET /api/posters/collection:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/posters/collection
 * Add a poster to the logged-in user's collection. Body: { posterId }.
 * Requires authentication.
 */
router.post('/collection', authenticate, async (req, res) => {
    try {
        const { posterId } = req.body;
        if (!posterId) {
            return res.status(400).json({ error: 'posterId is required' });
        }

        const { data: poster, error: posterError } = await supabaseAdmin
            .from('user_posters')
            .select('id')
            .eq('id', posterId)
            .single();
        if (posterError || !poster) {
            return res.status(404).json({ error: 'Poster not found' });
        }

        const { data, error } = await supabaseAdmin
            .from('user_poster_collection')
            .upsert(
                { user_id: req.user.id, poster_id: posterId },
                { onConflict: 'user_id,poster_id' }
            )
            .select()
            .single();

        if (error) {
            console.error('Error adding to poster collection:', error);
            return res.status(500).json({ error: 'Failed to add poster to collection' });
        }

        res.status(201).json(data);
    } catch (error) {
        console.error('Error in POST /api/posters/collection:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/posters/collection/:id
 * Remove a poster from the logged-in user's collection.
 */
router.delete('/collection/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('user_poster_collection')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) {
            console.error('Error removing from poster collection:', error);
            return res.status(500).json({ error: 'Failed to remove poster from collection' });
        }

        res.json({ message: 'Removed from collection' });
    } catch (error) {
        console.error('Error in DELETE /api/posters/collection/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// POSTER WANTS ENDPOINTS
// (shows a user is looking to acquire a poster for — a wishlist, independent
// of anything they already own in user_poster_collection)
// ============================================

/**
 * GET /api/posters/wants
 * The logged-in user's own wanted-posters list, each entry joined with its
 * show. Requires authentication.
 */
router.get('/wants', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_poster_wants')
            .select(`
                id,
                variant,
                created_at,
                shows (
                    id,
                    show_date,
                    artist_name,
                    tour_name,
                    venues ( name, city, state_country )
                )
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching poster wants:', error);
            return res.status(500).json({ error: 'Failed to fetch poster wants' });
        }

        res.json({ wants: data || [] });
    } catch (error) {
        console.error('Error in GET /api/posters/wants:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/posters/wants
 * Add a show to the logged-in user's wanted-posters list.
 * Body: { showId, variant } — variant is 'any' | 'regular' | 'foil', defaults to 'any'.
 */
router.post('/wants', authenticate, async (req, res) => {
    try {
        const { showId, variant } = req.body;
        if (!showId) {
            return res.status(400).json({ error: 'showId is required' });
        }
        const validVariants = ['any', 'regular', 'foil'];
        if (variant && !validVariants.includes(variant)) {
            return res.status(400).json({ error: `variant must be one of: ${validVariants.join(', ')}` });
        }

        const { data: show, error: showError } = await supabaseAdmin
            .from('shows')
            .select('id')
            .eq('id', showId)
            .single();
        if (showError || !show) {
            return res.status(404).json({ error: 'Show not found' });
        }

        const { data, error } = await supabaseAdmin
            .from('user_poster_wants')
            .upsert(
                { user_id: req.user.id, show_id: showId, variant: variant || 'any' },
                { onConflict: 'user_id,show_id' }
            )
            .select()
            .single();

        if (error) {
            console.error('Error adding poster want:', error);
            return res.status(500).json({ error: 'Failed to add to wanted list' });
        }

        res.status(201).json(data);
    } catch (error) {
        console.error('Error in POST /api/posters/wants:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/posters/wants/:id
 * Remove a show from the logged-in user's wanted-posters list.
 */
router.delete('/wants/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('user_poster_wants')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) {
            console.error('Error removing poster want:', error);
            return res.status(500).json({ error: 'Failed to remove from wanted list' });
        }

        res.json({ message: 'Removed from wanted list' });
    } catch (error) {
        console.error('Error in DELETE /api/posters/wants/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/posters/:posterId
 * Update poster caption
 */
router.put('/:posterId', authenticate, async (req, res) => {
    try {
        const { posterId } = req.params;
        const { caption } = req.body;
        const userId = req.user.id;

        // Check if user is admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single();

        const isAdmin = profile?.is_admin || false;

        // Get the poster to check ownership
        const { data: poster } = await supabaseAdmin
            .from('user_posters')
            .select('user_id')
            .eq('id', posterId)
            .single();

        if (!poster) {
            return res.status(404).json({ error: 'Poster not found' });
        }

        // Check if user owns the poster or is admin
        if (poster.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to update this poster' });
        }

        const { data: updatedPoster, error } = await supabaseAdmin
            .from('user_posters')
            .update({ caption })
            .eq('id', posterId)
            .select(`
                *,
                profiles:user_id (
                    id,
                    username,
                    display_name
                )
            `)
            .single();

        if (error) {
            console.error('Error updating poster:', error);
            return res.status(500).json({ error: 'Failed to update poster' });
        }

        res.json({ poster: updatedPoster });
    } catch (error) {
        console.error('Error in PUT /api/posters/:posterId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/posters/:posterId
 * Delete a poster (owner or admin only)
 */
router.delete('/:posterId', authenticate, async (req, res) => {
    try {
        const { posterId } = req.params;
        const userId = req.user.id;

        // Check if user is an admin or editor — both can delete any poster,
        // not just their own (editors help moderate a show's media alongside
        // admins; they still can't delete other users' accounts or the
        // catalog entities themselves — see server/middleware/requireRole.js).
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role, is_admin')
            .eq('id', userId)
            .single();

        const canModerate = profile?.is_admin || profile?.role === 'editor' || false;

        // Get the poster to check ownership and get file path
        const { data: poster } = await supabaseAdmin
            .from('user_posters')
            .select('user_id, poster_url')
            .eq('id', posterId)
            .single();

        if (!poster) {
            return res.status(404).json({ error: 'Poster not found' });
        }

        // Check if user owns the poster or can moderate
        if (poster.user_id !== userId && !canModerate) {
            return res.status(403).json({ error: 'Not authorized to delete this poster' });
        }

        // Delete from database
        const { error: dbError } = await supabaseAdmin
            .from('user_posters')
            .delete()
            .eq('id', posterId);

        if (dbError) {
            console.error('Error deleting poster from database:', dbError);
            return res.status(500).json({ error: 'Failed to delete poster' });
        }

        // Delete file from storage
        const fileName = poster.poster_url.split('/show-posters/')[1];
        if (fileName) {
            const { error: storageError } = await supabaseAdmin.storage
                .from('show-posters')
                .remove([fileName]);

            if (storageError) {
                console.error('Error deleting poster file:', storageError);
                // Don't fail the request if file deletion fails
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/posters/:posterId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

