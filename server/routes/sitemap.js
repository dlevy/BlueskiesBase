const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

const BASE_URL = 'https://www.blueskiesbase.com';

router.get('/', async (req, res) => {
    try {
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
        res.send(xml);
    } catch (err) {
        console.error('Sitemap error:', err);
        res.status(500).send('Failed to generate sitemap');
    }
});

module.exports = router;
