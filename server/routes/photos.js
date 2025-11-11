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
// USER PHOTOS ENDPOINTS
// ============================================

/**
 * GET /api/photos/show/:showId
 * Get all photos for a specific show
 */
router.get('/show/:showId', async (req, res) => {
    try {
        const { showId } = req.params;

        const { data: photos, error } = await supabaseAdmin
            .from('user_photos')
            .select(`
                *,
                profiles:user_id (
                    id,
                    username
                )
            `)
            .eq('show_id', showId)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching photos:', error);
            return res.status(500).json({ error: 'Failed to fetch photos' });
        }

        res.json({ photos });
    } catch (error) {
        console.error('Error in GET /api/photos/show/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/photos/upload
 * Upload a photo for a show
 */
router.post('/upload', authenticate, upload.single('photo'), async (req, res) => {
    try {
        const { show_id, caption } = req.body;
        const userId = req.user.id;
        const file = req.file;

        if (!show_id) {
            return res.status(400).json({ error: 'show_id is required' });
        }

        if (!file) {
            return res.status(400).json({ error: 'No photo file provided' });
        }

        // Generate unique filename
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${userId}/${show_id}/${Date.now()}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('show-photos')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error('Error uploading photo:', uploadError);
            return res.status(500).json({ error: 'Failed to upload photo' });
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('show-photos')
            .getPublicUrl(fileName);

        // Get the next display order
        const { data: existingPhotos } = await supabaseAdmin
            .from('user_photos')
            .select('display_order')
            .eq('show_id', show_id)
            .order('display_order', { ascending: false })
            .limit(1);

        const nextOrder = existingPhotos && existingPhotos.length > 0 
            ? existingPhotos[0].display_order + 1 
            : 0;

        // Save photo record to database
        const { data: photo, error: dbError } = await supabaseAdmin
            .from('user_photos')
            .insert({
                user_id: userId,
                show_id,
                photo_url: publicUrl,
                caption: caption || null,
                display_order: nextOrder
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
            console.error('Error saving photo record:', dbError);
            // Try to delete the uploaded file
            await supabaseAdmin.storage.from('show-photos').remove([fileName]);
            return res.status(500).json({ error: 'Failed to save photo record' });
        }

        res.json({ photo });
    } catch (error) {
        console.error('Error in POST /api/photos/upload:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/photos/:photoId
 * Update photo caption
 */
router.put('/:photoId', authenticate, async (req, res) => {
    try {
        const { photoId } = req.params;
        const { caption } = req.body;
        const userId = req.user.id;

        // Check if user is admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single();

        const isAdmin = profile?.is_admin || false;

        // Get the photo to check ownership
        const { data: photo, error: fetchError } = await supabaseAdmin
            .from('user_photos')
            .select('user_id')
            .eq('id', photoId)
            .single();

        if (fetchError || !photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Check if user owns the photo or is admin
        if (photo.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to update this photo' });
        }

        const { data: updatedPhoto, error: updateError } = await supabaseAdmin
            .from('user_photos')
            .update({ caption, updated_at: new Date().toISOString() })
            .eq('id', photoId)
            .select(`
                *,
                profiles:user_id (
                    id,
                    username
                )
            `)
            .single();

        if (updateError) {
            console.error('Error updating photo:', updateError);
            return res.status(500).json({ error: 'Failed to update photo' });
        }

        res.json({ photo: updatedPhoto });
    } catch (error) {
        console.error('Error in PUT /api/photos/:photoId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/photos/:photoId
 * Delete a photo (user can delete their own, admin can delete any)
 */
router.delete('/:photoId', authenticate, async (req, res) => {
    try {
        const { photoId } = req.params;
        const userId = req.user.id;

        // Check if user is admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single();

        const isAdmin = profile?.is_admin || false;

        // Get the photo to check ownership and get URL
        const { data: photo, error: fetchError } = await supabaseAdmin
            .from('user_photos')
            .select('user_id, photo_url')
            .eq('id', photoId)
            .single();

        if (fetchError || !photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Check if user owns the photo or is admin
        if (photo.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this photo' });
        }

        // Extract file path from URL
        const urlParts = photo.photo_url.split('/show-photos/');
        const filePath = urlParts.length > 1 ? urlParts[1] : null;

        // Delete from database
        const { error: deleteError } = await supabaseAdmin
            .from('user_photos')
            .delete()
            .eq('id', photoId);

        if (deleteError) {
            console.error('Error deleting photo record:', deleteError);
            return res.status(500).json({ error: 'Failed to delete photo' });
        }

        // Delete from storage
        if (filePath) {
            const { error: storageError } = await supabaseAdmin.storage
                .from('show-photos')
                .remove([filePath]);

            if (storageError) {
                console.error('Error deleting photo from storage:', storageError);
                // Don't fail the request if storage deletion fails
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/photos/:photoId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

