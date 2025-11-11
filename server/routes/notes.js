const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');

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

/**
 * Middleware to check if user is admin
 */
const checkAdmin = async (req, res, next) => {
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', req.user.id)
        .single();

    if (error || !profile || !profile.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    req.isAdmin = true;
    next();
};

// ============================================
// USER NOTES ENDPOINTS
// ============================================

/**
 * GET /api/notes/show/:showId
 * Get all notes for a specific show
 */
router.get('/show/:showId', async (req, res) => {
    try {
        const { showId } = req.params;

        const { data: notes, error } = await supabaseAdmin
            .from('user_notes')
            .select(`
                *,
                profiles:user_id (
                    id,
                    username
                )
            `)
            .eq('show_id', showId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching notes:', error);
            return res.status(500).json({ error: 'Failed to fetch notes' });
        }

        res.json({ notes });
    } catch (error) {
        console.error('Error in GET /api/notes/show/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/notes/user/:showId
 * Get the authenticated user's note for a specific show
 */
router.get('/user/:showId', authenticate, async (req, res) => {
    try {
        const { showId } = req.params;
        const userId = req.user.id;

        const { data: note, error } = await supabaseAdmin
            .from('user_notes')
            .select('*')
            .eq('show_id', showId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching user note:', error);
            return res.status(500).json({ error: 'Failed to fetch note' });
        }

        res.json({ note });
    } catch (error) {
        console.error('Error in GET /api/notes/user/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/notes
 * Create or update a note for a show
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { show_id, note_text } = req.body;
        const userId = req.user.id;

        if (!show_id || !note_text) {
            return res.status(400).json({ error: 'show_id and note_text are required' });
        }

        // Check if note already exists
        const { data: existingNote } = await supabaseAdmin
            .from('user_notes')
            .select('id')
            .eq('show_id', show_id)
            .eq('user_id', userId)
            .maybeSingle();

        let result;
        if (existingNote) {
            // Update existing note
            result = await supabaseAdmin
                .from('user_notes')
                .update({ note_text, updated_at: new Date().toISOString() })
                .eq('id', existingNote.id)
                .select()
                .single();
        } else {
            // Create new note
            result = await supabaseAdmin
                .from('user_notes')
                .insert({ user_id: userId, show_id, note_text })
                .select()
                .single();
        }

        if (result.error) {
            console.error('Error saving note:', result.error);
            return res.status(500).json({ error: 'Failed to save note' });
        }

        res.json({ note: result.data });
    } catch (error) {
        console.error('Error in POST /api/notes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/notes/:noteId
 * Delete a note (user can delete their own, admin can delete any)
 */
router.delete('/:noteId', authenticate, async (req, res) => {
    try {
        const { noteId } = req.params;
        const userId = req.user.id;

        // Check if user is admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single();

        const isAdmin = profile?.is_admin || false;

        // Get the note to check ownership
        const { data: note, error: fetchError } = await supabaseAdmin
            .from('user_notes')
            .select('user_id')
            .eq('id', noteId)
            .single();

        if (fetchError || !note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Check if user owns the note or is admin
        if (note.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this note' });
        }

        const { error: deleteError } = await supabaseAdmin
            .from('user_notes')
            .delete()
            .eq('id', noteId);

        if (deleteError) {
            console.error('Error deleting note:', deleteError);
            return res.status(500).json({ error: 'Failed to delete note' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/notes/:noteId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

