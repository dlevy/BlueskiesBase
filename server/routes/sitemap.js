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

// Must match client/src/utils/showSlug.js and the slugify in server/routes/shows.js.
function slugify(str) {
    return (str || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Mirrors buildShowPath in client/src/utils/showSlug.js:
//   /show/{artist}/{YYYY-MM-DD}/{city-state}
// Returns null when a segment would be empty — the :artist/:date/:locationSlug
// route needs all three, so a partial path is a dead URL not worth listing.
function buildShowPath(show) {
    const artist = slugify(show.artist_name);
    const date = show.show_date;
    const location = [slugify(show.venues?.city), slugify(show.venues?.state_country)]
        .filter(Boolean)
        .join('-');
    if (!artist || !date || !location) return null;
    return `/show/${artist}/${date}/${location}`;
}

function escapeXml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

router.get('/', async (req, res) => {
    try {
        const BASE_URL = baseUrlFor(req);

        const { data: shows, error } = await supabaseAdmin
            .from('shows')
            .select('show_date, updated_at, artist_name, venues(city, state_country)')
            .order('show_date', { ascending: false });

        if (error) throw error;

        const staticPages = [
            { url: '/', priority: '1.0', changefreq: 'daily' },
            { url: '/stats', priority: '0.7', changefreq: 'weekly' },
        ];

        // Two shows can slug to the same path (same artist, date and city, e.g. a
        // festival's two stages) because the slug omits the venue. /api/shows/lookup
        // can only resolve one of them, so leave every colliding path out entirely
        // rather than advertising a URL that points at the wrong show. Revisit once
        // the URL scheme disambiguates them.
        const byPath = new Map();
        let unmappable = 0;

        for (const show of shows || []) {
            const url = buildShowPath(show);
            if (!url) {
                unmappable++;
                continue;
            }
            if (!byPath.has(url)) byPath.set(url, []);
            byPath.get(url).push(show);
        }

        const showUrls = [];
        const colliding = [];

        for (const [url, matches] of byPath) {
            if (matches.length > 1) {
                colliding.push(url);
                continue;
            }
            const [show] = matches;
            showUrls.push({
                url,
                priority: '0.8',
                changefreq: 'monthly',
                lastmod: show.updated_at ? show.updated_at.split('T')[0] : show.show_date,
            });
        }

        if (unmappable) {
            console.warn(`Sitemap: skipped ${unmappable} show(s) with no artist or venue location`);
        }
        if (colliding.length) {
            console.warn(`Sitemap: omitted ${colliding.length} ambiguous path(s): ${colliding.join(', ')}`);
        }

        const allUrls = [...staticPages, ...showUrls];

        // Child order below is fixed by the sitemap schema: loc, lastmod, changefreq, priority.
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(({ url, priority, changefreq, lastmod }) => `  <url>
    <loc>${escapeXml(BASE_URL + url)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
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
