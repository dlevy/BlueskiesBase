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
    banner: {
        enabled: true,
        prefixText: 'Follow',
        linkText: '@jbssetlists',
        linkUrl: 'https://www.instagram.com/jbssetlists/',
        suffixText: 'for face-melting setlists to your IG feed.',
        color: '#fbbf24',
        scheduledOffAt: null,
    },
};

const MAX_FOOTER_LINKS = 8;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * GET /api/settings
 * Public, no auth required — site-wide editable text (header title/subtitle
 * shown on every page, and the footer credit/link items).
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('header_title, header_subtitle, footer_links, banner')
            .eq('id', true)
            .single();

        if (error || !data) {
            return res.json(DEFAULTS);
        }

        res.json({
            headerTitle: data.header_title,
            headerSubtitle: data.header_subtitle,
            footerLinks: data.footer_links,
            banner: data.banner || DEFAULTS.banner,
        });
    } catch (err) {
        console.error('[GET /api/settings] Error:', err);
        res.json(DEFAULTS);
    }
});

/**
 * PUT /api/settings
 * Update site-wide editable text. Admin only.
 * Body: { headerTitle?, headerSubtitle?, footerLinks?, banner? }
 * footerLinks: [{ text, url? }, ...], up to MAX_FOOTER_LINKS items.
 * banner: { enabled, prefixText?, linkText?, linkUrl?, suffixText?, color?, scheduledOffAt? } —
 * linkText and linkUrl must be given together or not at all. scheduledOffAt
 * is an optional ISO timestamp; once it passes, the client reverts the
 * banner's *content* to the standing default (see AnnouncementBanner.jsx) —
 * this stored value never changes on its own, the reversion is computed at
 * display time from the current clock vs. this timestamp.
 */
router.put('/', requireAdmin, async (req, res) => {
    try {
        const { headerTitle, headerSubtitle, footerLinks, banner } = req.body;
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
        if (banner !== undefined) {
            if (typeof banner !== 'object' || banner === null || Array.isArray(banner)) {
                return res.status(400).json({ error: 'banner must be an object' });
            }

            const prefixText = (banner.prefixText || '').trim();
            const linkText = (banner.linkText || '').trim();
            const suffixText = (banner.suffixText || '').trim();
            let linkUrl = (banner.linkUrl || '').trim();
            const color = (banner.color || '').trim();

            if (prefixText.length > 150) return res.status(400).json({ error: 'Banner text must be 150 characters or fewer' });
            if (linkText.length > 100) return res.status(400).json({ error: 'Banner link text must be 100 characters or fewer' });
            if (suffixText.length > 150) return res.status(400).json({ error: 'Banner text must be 150 characters or fewer' });

            // The linked phrase and its URL only make sense together — one
            // without the other is either a dead link or an orphaned URL.
            if (Boolean(linkText) !== Boolean(linkUrl)) {
                return res.status(400).json({ error: 'Banner link text and link URL must be given together' });
            }
            if (linkUrl) {
                if (linkUrl.length > 300) return res.status(400).json({ error: 'Banner link URL must be 300 characters or fewer' });
                try {
                    new URL(linkUrl);
                } catch {
                    return res.status(400).json({ error: `"${linkUrl}" is not a valid URL` });
                }
            } else {
                linkUrl = null;
            }

            if (color && !HEX_COLOR_RE.test(color)) {
                return res.status(400).json({ error: 'Banner color must be a hex color like #fbbf24' });
            }

            let scheduledOffAt = null;
            if (banner.scheduledOffAt) {
                const parsed = new Date(banner.scheduledOffAt);
                if (isNaN(parsed.getTime())) {
                    return res.status(400).json({ error: 'Banner schedule must be a valid date/time' });
                }
                scheduledOffAt = parsed.toISOString();
            }

            updates.banner = {
                enabled: Boolean(banner.enabled),
                prefixText,
                linkText,
                linkUrl,
                suffixText,
                color: color || DEFAULTS.banner.color,
                scheduledOffAt,
            };
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('site_settings')
            .update(updates)
            .eq('id', true)
            .select('header_title, header_subtitle, footer_links, banner')
            .single();

        if (error) {
            console.error('[PUT /api/settings] Error:', error);
            return res.status(500).json({ error: 'Failed to update settings' });
        }

        res.json({
            headerTitle: data.header_title,
            headerSubtitle: data.header_subtitle,
            footerLinks: data.footer_links,
            banner: data.banner,
        });
    } catch (err) {
        console.error('[PUT /api/settings] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
