const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

const FALLBACK_BASE_URL = 'https://www.skysets.org';

// Google rejects a sitemap whose <loc> host differs from the host it was fetched
// from, so derive the base URL from the request rather than hardcoding a domain.
function baseUrlFor(req) {
    if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
    const host = req.get('x-forwarded-host') || req.get('host');
    if (!host) return FALLBACK_BASE_URL;
    const proto = req.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
}

router.get('/', async (req, res) => {
    try {
        const BASE_URL = baseUrlFor(req);

        const { data: shows, error } = await supabaseAdmin
            .from('shows')
            .select('id, show_date, updated_at')
            .order('show_date', { ascending: false });

        if (error) throw error;

        const staticPages = [
            { url: '/', priority: '1.0', changefreq: 'daily' },
        ];

        const showUrls = (shows || []).map(show => ({
            url: `/shows/${show.id}`,
            priority: '0.8',
            changefreq: 'monthly',
            lastmod: show.updated_at ? show.updated_at.split('T')[0] : show.show_date,
        }));

        const allUrls = [...staticPages, ...showUrls];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(({ url, priority, changefreq, lastmod }) => `  <url>
    <loc>${BASE_URL}${url}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Vary', 'Host, X-Forwarded-Host');
        res.send(xml);
    } catch (err) {
        console.error('Sitemap error:', err);
        res.status(500).send('Failed to generate sitemap');
    }
});

module.exports = router;
