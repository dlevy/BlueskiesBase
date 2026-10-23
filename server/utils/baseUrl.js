const FALLBACK_BASE_URL = 'https://www.skysets.org';

// Google rejects a sitemap whose <loc> host differs from the host it was fetched
// from, so derive the base URL from the request rather than hardcoding a domain.
// Shared by sitemap.js (sitemap <loc> entries) and showMeta.js (canonical/og:url
// injection) — both need "what's our own domain" and must never drift apart.
function baseUrlFor(req) {
    if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
    const host = req.get('x-forwarded-host') || req.get('host');
    if (!host) return FALLBACK_BASE_URL;
    const proto = req.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
}

module.exports = { baseUrlFor, FALLBACK_BASE_URL };
