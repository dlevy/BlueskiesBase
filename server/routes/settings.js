const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');
const { requireAdmin } = require('../middleware/requireRole');

// Historical hardcoded values, used as a fallback if the singleton row is
// ever missing (shouldn't happen once the migration's seed insert has run,
// but keeps the header from rendering blank if it somehow is).
const DEFAULTS = {
    headerTitle: 'Skysets.org - JBS / Sturgill Simpson Media Archive',
    headerSubtitle: 'Johnny Blue Skies & The Dark Clouds Concert Setlist Archive',
    footerLinks: [
        { text: 'Created and maintained by Daniel Levy', url: null },
        { text: 'Initial setlist import thanks to Setlist.fm', url: 'https://www.setlist.fm' },
        { text: 'Inspired by crowesbase.com', url: 'https://www.crowesbase.com' },
    ],
};

const MAX_FOOTER_LINKS = 8;

/**
 * GET /api/settings
 * Public, no auth required — site-wide editable text (header title/subtitle
 * shown on every page, and the footer credit/link items).
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('header_title, header_subtitle, footer_links')
            .eq('id', true)
            .single();

        if (error || !data) {
            return res.json(DEFAULTS);
        }

        res.json({ headerTitle: data.header_title, headerSubtitle: data.header_subtitle, footerLinks: data.footer_links });
    } catch (err) {
        console.error('[GET /api/settings] Error:', err);
        res.json(DEFAULTS);
    }
});

/**
 * PUT /api/settings
 * Update site-wide editable text. Admin only.
 * Body: { headerTitle?, headerSubtitle?, footerLinks? }
 * footerLinks: [{ text, url? }, ...], up to MAX_FOOTER_LINKS items.
 */
router.put('/', requireAdmin, async (req, res) => {
    try {
        const { headerTitle, headerSubtitle, footerLinks } = req.body;
        const updates = {};

        if (headerTitle !== undefined) {
            const trimmed = headerTitle.trim();
            if (!trimmed) return res.status(400).json({ error: 'Header title cannot be empty' });
            if (trimmed.length > 200) return res.status(400).json({ error: 'Header title must be 200 characters or fewer' });
            updates.header_title = trimmed;
        }
        if (headerSubtitle !== undefined) {
            const trimmed = headerSubtitle.trim();
            if (trimmed.length > 300) return res.status(400).json({ error: 'Header subtitle must be 300 characters or fewer' });
            updates.header_subtitle = trimmed;
        }
        if (footerLinks !== undefined) {
            if (!Array.isArray(footerLinks)) {
                return res.status(400).json({ error: 'footerLinks must be an array' });
            }
            if (footerLinks.length > MAX_FOOTER_LINKS) {
                return res.status(400).json({ error: `footerLinks can have at most ${MAX_FOOTER_LINKS} items` });
            }

            const sanitized = [];
            for (let i = 0; i < footerLinks.length; i++) {
                const item = footerLinks[i] || {};
                const text = (item.text || '').trim();
                if (!text) return res.status(400).json({ error: `Item ${i + 1}: text is required` });
                if (text.length > 150) return res.status(400).json({ error: `Item ${i + 1}: text must be 150 characters or fewer` });

                let url = (item.url || '').trim();
                if (url) {
                    if (url.length > 300) return res.status(400).json({ error: `Item ${i + 1}: URL must be 300 characters or fewer` });
                    try {
                        new URL(url);
                    } catch {
                        return res.status(400).json({ error: `Item ${i + 1}: "${url}" is not a valid URL` });
                    }
                } else {
                    url = null;
                }

                sanitized.push({ text, url });
            }
            updates.footer_links = sanitized;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('site_settings')
            .update(updates)
            .eq('id', true)
            .select('header_title, header_subtitle, footer_links')
            .single();

        if (error) {
            console.error('[PUT /api/settings] Error:', error);
            return res.status(500).json({ error: 'Failed to update settings' });
        }

        res.json({ headerTitle: data.header_title, headerSubtitle: data.header_subtitle, footerLinks: data.footer_links });
    } catch (err) {
        console.error('[PUT /api/settings] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
