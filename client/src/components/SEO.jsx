import { useEffect } from 'react';

const SITE_NAME = 'SkySets.org';
const DEFAULT_TITLE = `${SITE_NAME} – Johnny Blue Skies & Sturgill Simpson Concert Setlists`;
const DEFAULT_DESC = 'The complete Johnny Blue Skies & The Dark Clouds and Sturgill Simpson concert setlist archive — search 400+ shows from 2012 to present.';

function setMeta(selector, attr, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
}

// A page's canonical URL is always its own clean path — never whatever
// tracking query string or trailing slash the visitor actually arrived
// with (e.g. a show URL with "?utm_source=..." or a trailing "/" currently
// serves identical content with no canonical tag, so Google has no signal
// which URL is the "real" one). Strips both, but keeps a bare "/" as-is.
function cleanPath(pathname) {
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

// `path` lets a page declare its own canonical path explicitly (e.g.
// ShowDetailPage passes buildShowPath(show) — the show's true canonical
// URL — rather than whatever raw :artist/:date/:location params the visitor
// arrived with, same source of truth the server-side prerender in
// server/utils/showMeta.js uses). Omitted everywhere else, where the
// current pathname is already the canonical one.
export default function SEO({ title, description, jsonLd, path, noindex = false }) {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESC;

    useEffect(() => {
        const canonicalUrl = `${window.location.origin}${cleanPath(path || window.location.pathname)}`;

        document.title = fullTitle;
        setMeta('meta[name="robots"]', 'content', noindex ? 'noindex, nofollow' : 'index, follow');
        setMeta('meta[name="description"]', 'content', desc);
        setMeta('meta[property="og:title"]', 'content', fullTitle);
        setMeta('meta[property="og:description"]', 'content', desc);
        setMeta('meta[property="og:url"]', 'content', canonicalUrl);
        setMeta('meta[name="twitter:title"]', 'content', fullTitle);
        setMeta('meta[name="twitter:description"]', 'content', desc);
        setMeta('link[rel="canonical"]', 'href', canonicalUrl);

        const existing = document.getElementById('json-ld-seo');
        if (jsonLd) {
            const script = existing || document.createElement('script');
            script.id = 'json-ld-seo';
            script.type = 'application/ld+json';
            script.textContent = JSON.stringify(jsonLd);
            if (!existing) document.head.appendChild(script);
        } else if (existing) {
            existing.remove();
        }

        return () => {
            const s = document.getElementById('json-ld-seo');
            if (s) s.remove();
        };
    }, [fullTitle, desc, jsonLd, path, noindex]);

    return null;
}
