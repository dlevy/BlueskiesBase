const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAdmin, requireEditorOrAdmin } = require('../middleware/requireRole');

// Shared select — embeds both the category and the optional associated
// member account (shown as "by @username" on the public page).
const LINK_SELECT = '*, link_categories(id, name, sort_order), member:profiles!links_member_id_fkey(id, username, display_name, avatar_url)';

// ============================================
// LINK CATEGORIES
// Declared before the generic /:id link routes below, same ordering posters.js
// uses for its /collection and /wants sub-resources vs. /:posterId.
// ============================================

/**
 * GET /api/links/categories
 * All link categories, in admin-defined display order.
 */
router.get('/categories', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('link_categories')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error fetching link categories:', error);
            return res.status(500).json({ error: 'Failed to fetch link categories' });
        }

        res.json({ categories: data || [] });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/links/categories
 * Create a new category (editor or admin). Appends to the end of the display
 * order — the admin UI reorders afterward via PUT.
 */
router.post('/categories', requireEditorOrAdmin, async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const { data: existing } = await supabase
            .from('link_categories')
            .select('sort_order')
            .order('sort_order', { ascending: false })
            .limit(1);

        const nextSortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;

        const { data: category, error } = await supabase
            .from('link_categories')
            .insert([{ name: name.trim(), sort_order: nextSortOrder }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'A category with this name already exists' });
            console.error('Error creating link category:', error);
            return res.status(500).json({ error: 'Failed to create category' });
        }

        res.status(201).json({ category });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/links/categories/:id
 * Update a category's name and/or sort_order (editor or admin).
 */
router.put('/categories/:id', requireEditorOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, sort_order } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (sort_order !== undefined) updates.sort_order = sort_order;
        updates.updated_at = new Date().toISOString();

        const { data: category, error } = await supabase
            .from('link_categories')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'A category with this name already exists' });
            console.error('Error updating link category:', error);
            return res.status(500).json({ error: 'Failed to update category' });
        }

        res.json({ category });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/links/categories/:id
 * Delete a category (admin only). Links in this category fall back to null
 * (rendered under "Other" on the public page) via ON DELETE SET NULL.
 */
router.delete('/categories/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('link_categories')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting link category:', error);
            return res.status(500).json({ error: 'Failed to delete category' });
        }

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// LINKS
// ============================================

/**
 * GET /api/links
 * All links with their category embedded, ordered by category display order
 * then link display order. Grouping (including the "Other" bucket for
 * null-category links) happens client-side, same as PhotosPage groups by show.
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('links')
            .select(LINK_SELECT)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error fetching links:', error);
            return res.status(500).json({ error: 'Failed to fetch links' });
        }

        res.json({ links: data || [] });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/links
 * Create a new link (editor or admin).
 */
router.post('/', requireEditorOrAdmin, async (req, res) => {
    try {
        const { category_id, member_id, title, url, description, sort_order } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Link title is required' });
        }
        if (!url || !url.trim()) {
            return res.status(400).json({ error: 'Link URL is required' });
        }

        const { data: link, error } = await supabase
            .from('links')
            .insert([{
                category_id: category_id || null,
                member_id: member_id || null,
                title: title.trim(),
                url: url.trim(),
                description: description || null,
                sort_order: sort_order ?? 0,
            }])
            .select(LINK_SELECT)
            .single();

        if (error) {
            console.error('Error creating link:', error);
            return res.status(500).json({ error: 'Failed to create link' });
        }

        res.status(201).json({ link });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/links/:id
 * Update a link (editor or admin).
 */
router.put('/:id', requireEditorOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, member_id, title, url, description, sort_order } = req.body;

        const updates = {};
        if (category_id !== undefined) updates.category_id = category_id || null;
        if (member_id !== undefined) updates.member_id = member_id || null;
        if (title !== undefined) updates.title = title.trim();
        if (url !== undefined) updates.url = url.trim();
        if (description !== undefined) updates.description = description || null;
        if (sort_order !== undefined) updates.sort_order = sort_order;
        updates.updated_at = new Date().toISOString();

        const { data: link, error } = await supabase
            .from('links')
            .update(updates)
            .eq('id', id)
            .select(LINK_SELECT)
            .single();

        if (error) {
            console.error('Error updating link:', error);
            return res.status(500).json({ error: 'Failed to update link' });
        }

        res.json({ link });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/links/:id
 * Delete a link (admin only).
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('links')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting link:', error);
            return res.status(500).json({ error: 'Failed to delete link' });
        }

        res.json({ message: 'Link deleted successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
