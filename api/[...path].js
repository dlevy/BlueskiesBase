const express = require('express');
const { findShowByPathParams, injectShowHead } = require('../server/utils/showMeta');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel may or may not include /api prefix in req.url for catch-all functions.
// Normalize so routes mounted at /api/* always match.
app.use((req, _res, next) => {
    if (!req.url.startsWith('/api/') && req.url !== '/api') {
        req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    next();
});

// Server-rendered meta/JSON-LD for /show/:artist/:date/:location — the SPA
// normally injects title/description/Event structured data client-side
// (client/src/components/SEO.jsx), but that only runs after React mounts and
// the show fetch resolves. Crawlers that don't wait for that (Google Search
// Console flagged these pages as missing required Event fields) get an
// empty <div id="root">, so this prerenders the same tags into the static
// index.html before it's served, for this route only. vercel.json routes
// /show/* here instead of straight to /index.html for that reason.
app.get('/api/show/:artist/:date/:location', async (req, res) => {
    try {
        const { artist, date, location } = req.params;
        const host = req.get('x-forwarded-host') || req.get('host');
        const proto = req.get('x-forwarded-proto') || 'https';
        const indexRes = await fetch(`${proto}://${host}/index.html`);
        const html = await indexRes.text();

        const show = await findShowByPathParams({ artist, date, location });
        const body = show ? injectShowHead(html, show) : html;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
        res.status(200).send(body);
    } catch (err) {
        console.error('[GET /show/:artist/:date/:location] Prerender error:', err);
        // Fall through to the normal SPA shell rather than erroring the page —
        // the client-side <SEO> component still covers the common case.
        try {
            const host = req.get('x-forwarded-host') || req.get('host');
            const proto = req.get('x-forwarded-proto') || 'https';
            const indexRes = await fetch(`${proto}://${host}/index.html`);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(await indexRes.text());
        } catch (fallbackErr) {
            console.error('[GET /show/:artist/:date/:location] Fallback fetch also failed:', fallbackErr);
            res.status(500).send('Internal server error');
        }
    }
});

app.use('/api/shows', require('../server/routes/shows'));
app.use('/api/songs', require('../server/routes/songs'));
app.use('/api/albums', require('../server/routes/albums'));
app.use('/api/venues', require('../server/routes/venues'));
app.use('/api/search', require('../server/routes/search'));
app.use('/api/users', require('../server/routes/users'));
app.use('/api/admin', require('../server/routes/admin'));
app.use('/api/notes', require('../server/routes/notes'));
app.use('/api/photos', require('../server/routes/photos'));
app.use('/api/posters', require('../server/routes/posters'));
app.use('/api/bands', require('../server/routes/bands'));
app.use('/api/sitemap.xml', require('../server/routes/sitemap'));
app.use('/api/setlist-submissions', require('../server/routes/setlist-submissions'));
app.use('/api/links', require('../server/routes/links'));
app.use('/api/settings', require('../server/routes/settings'));
app.use('/api/thanks', require('../server/routes/thanks'));
app.use('/api/notifications', require('../server/routes/notifications'));
app.use('/api/band-members', require('../server/routes/band-members'));
app.use('/api/analytics', require('../server/routes/analytics'));

app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.url });
});

module.exports = app;
module.exports.config = {
    api: {
        bodyParser: false
    }
};
