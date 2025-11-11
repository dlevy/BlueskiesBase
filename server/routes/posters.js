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
 * GET /api/posters/show/:showId
 * Get poster for a specific show
 */
router.get('/show/:showId', async (req, res) => {
    try {
        const { showId } = req.params;

        const { data: poster, error } = await supabaseAdmin
            .from('user_posters')
            .select(`
                *,
                profiles:user_id (
                    id,
                    username
                )
            `)
            .eq('show_id', showId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching poster:', error);
            return res.status(500).json({ error: 'Failed to fetch poster' });
        }

        res.json({ poster: poster || null });
    } catch (error) {
        console.error('Error in GET /api/posters/show/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/posters/upload
 * Upload a poster for a show (replaces existing poster if any)
 */
router.post('/upload', authenticate, upload.single('poster'), async (req, res) => {
    try {
        const { show_id, caption } = req.body;
        const userId = req.user.id;
        const file = req.file;

        if (!show_id) {
            return res.status(400).json({ error: 'show_id is required' });
        }

        if (!file) {
            return res.status(400).json({ error: 'No poster file provided' });
        }

        // Check if poster already exists for this show
        const { data: existingPoster } = await supabaseAdmin
            .from('user_posters')
            .select('id, poster_url, user_id')
            .eq('show_id', show_id)
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
                        username
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
                caption: caption || null
            })
            .select(`
                *,
                profiles:user_id (
                    id,
                    username
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
                    username
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

        // Check if user is admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single();

        const isAdmin = profile?.is_admin || false;

        // Get the poster to check ownership and get file path
        const { data: poster } = await supabaseAdmin
            .from('user_posters')
            .select('user_id, poster_url')
            .eq('id', posterId)
            .single();

        if (!poster) {
            return res.status(404).json({ error: 'Poster not found' });
        }

        // Check if user owns the poster or is admin
        if (poster.user_id !== userId && !isAdmin) {
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

