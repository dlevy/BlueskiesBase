const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { baseUrlFor } = require('../utils/baseUrl');
const { isHiddenFromSearch } = require('../utils/showMeta');

// Every show id with at least one non-soundcheck setlist row — paginated,
// since setlist_songs is far past PostgREST's 1000-row default.
async function fetchShowIdsWithSetlist() {
    const ids = new Set();
    for (let rangeStart = 0; ; rangeStart += 1000) {
        const { data, error } = await supabaseAdmin
            .from('setlist_songs')
            .select('show_id')
            .neq('performance_type', 'soundcheck')
            .order('id')
            .range(rangeStart, rangeStart + 999);
        if (error) throw error;
        data.forEach(r => ids.add(r.show_id));
        if (data.length < 1000) break;
    }
    return ids;
}

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

function buildSongPath(title) {
    return `/songs/${slugify(title)}`;
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

        const [{ data: shows, error }, showIdsWithSetlist] = await Promise.all([
            supabaseAdmin
                .from('shows')
                .select('id, show_date, updated_at, artist_name, tour_name, is_cancelled, venues(city, state_country)')
                .order('show_date', { ascending: false }),
            fetchShowIdsWithSetlist(),
        ]);

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
        let hiddenNoSetlist = 0;

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
            // Same rule as the page's own noindex (see showMeta.js) — a page
            // Google is told not to index shouldn't be advertised here either.
            // Checked after the collision skip above, so a hidden show still
            // blocks a shared path rather than letting its twin be listed.
            if (isHiddenFromSearch(show.show_date, showIdsWithSetlist.has(show.id))) {
                hiddenNoSetlist++;
                continue;
            }
            showUrls.push({
                url,
                priority: '0.8',
                changefreq: 'monthly',
                lastmod: show.updated_at ? show.updated_at.split('T')[0] : show.show_date,
            });
        }

        if (hiddenNoSetlist) {
            console.log(`Sitemap: left out ${hiddenNoSetlist} past show(s) with no setlist yet`);
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
            if (!show.is_cancelled && show.show_date >= todayStr) entry.hasUpcoming = true;
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

        // One <url> per song that actually has lyrics — nothing else there to
        // index. Same slug-collision-skip pattern as shows/tours above (two
        // different songs sharing a title is a data-entry collision, e.g.
        // "Machine Gun," not a legitimate ambiguity).
        const { data: songs, error: songsError } = await supabaseAdmin
            .from('songs')
            .select('title, lyrics, updated_at')
            .not('lyrics', 'is', null);
        if (songsError) throw songsError;

        const songByPath = new Map();
        for (const song of songs || []) {
            if (!song.lyrics?.trim()) continue;
            const url = buildSongPath(song.title);
            if (!songByPath.has(url)) songByPath.set(url, []);
            songByPath.get(url).push(song);
        }

        const songUrls = [];
        const collidingSongs = [];
        for (const [url, matches] of songByPath) {
            if (matches.length > 1) {
                collidingSongs.push(url);
                continue;
            }
            const [song] = matches;
            songUrls.push({
                url,
                priority: '0.6',
                changefreq: 'monthly',
                lastmod: song.updated_at ? song.updated_at.split('T')[0] : undefined,
            });
        }
        if (collidingSongs.length) {
            console.warn(`Sitemap: omitted ${collidingSongs.length} ambiguous song path(s): ${collidingSongs.join(', ')}`);
        }

        const allUrls = [...staticPages, ...showUrls, ...tourUrls, ...songUrls];

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
