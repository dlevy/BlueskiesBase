const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { baseUrlFor } = require('../utils/baseUrl');

// Must match client/src/utils/showSlug.js and the slugify in server/routes/shows.js.
function slugify(str) {
    return (str || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Must match MIN_TOUR_SHOWS in client/src/utils/tourSongCounts.js — the
// sitemap should never advertise a /tours/* URL the public tour dropdown
// itself wouldn't surface.
const MIN_TOUR_SHOWS = 5;

function buildTourPath(tourName) {
    return `/tours/${slugify(tourName)}`;
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
            .select('show_date, updated_at, artist_name, tour_name, venues(city, state_country)')
            .order('show_date', { ascending: false });

        if (error) throw error;

        // /stats (StatsPage.jsx) requires login and redirects anonymous
        // visitors to /member-login — not indexable content, so it isn't
        // listed here (see also its own <SEO> call's noindex robots tag).
        const staticPages = [
            { url: '/', priority: '1.0', changefreq: 'daily' },
            { url: '/faq', priority: '0.5', changefreq: 'monthly' },
            { url: '/how-to-use', priority: '0.5', changefreq: 'monthly' },
            { url: '/about', priority: '0.5', changefreq: 'monthly' },
            { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
            { url: '/terms', priority: '0.3', changefreq: 'yearly' },
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

        // One <url> per tour with at least MIN_TOUR_SHOWS shows — same
        // collision-skip pattern as showUrls above (a slug matching more than
        // one distinct tour_name is a data-entry mistake, not a legitimate
        // ambiguity, so it's omitted and logged rather than guessed at).
        const todayStr = new Date().toISOString().slice(0, 10);
        const tourByName = new Map();
        for (const show of shows || []) {
            if (!show.tour_name) continue;
            const entry = tourByName.get(show.tour_name) || { count: 0, hasUpcoming: false, lastTouched: null };
            entry.count++;
            if (show.show_date >= todayStr) entry.hasUpcoming = true;
            const touched = show.updated_at ? show.updated_at.split('T')[0] : show.show_date;
            if (!entry.lastTouched || touched > entry.lastTouched) entry.lastTouched = touched;
            tourByName.set(show.tour_name, entry);
        }

        const tourByPath = new Map();
        for (const [tourName, entry] of tourByName) {
            if (entry.count < MIN_TOUR_SHOWS) continue;
            const url = buildTourPath(tourName);
            if (!tourByPath.has(url)) tourByPath.set(url, []);
            tourByPath.get(url).push({ tourName, entry });
        }

        const tourUrls = [];
        const collidingTours = [];
        for (const [url, matches] of tourByPath) {
            if (matches.length > 1) {
                collidingTours.push(url);
                continue;
            }
            const { entry } = matches[0];
            tourUrls.push({
                url,
                priority: '0.7',
                changefreq: entry.hasUpcoming ? 'daily' : 'weekly',
                lastmod: entry.lastTouched,
            });
        }
        if (collidingTours.length) {
            console.warn(`Sitemap: omitted ${collidingTours.length} ambiguous tour path(s): ${collidingTours.join(', ')}`);
        }

        const allUrls = [...staticPages, ...showUrls, ...tourUrls];

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
