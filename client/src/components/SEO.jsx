import { useEffect } from 'react';

const SITE_NAME = 'blueskiesbase';
const DEFAULT_TITLE = `${SITE_NAME} – Sturgill Simpson & Johnny Blue Skies Setlists`;
const DEFAULT_DESC = 'The complete Sturgill Simpson and Johnny Blue Skies setlist database. Search 400+ concerts from 2012 to present, including the Why Not? and Who the F**k Is Johnny Blue Skies? tours.';

function setMeta(selector, attr, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
}

export default function SEO({ title, description, jsonLd }) {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESC;

    useEffect(() => {
        document.title = fullTitle;
        setMeta('meta[name="description"]', 'content', desc);
        setMeta('meta[property="og:title"]', 'content', fullTitle);
        setMeta('meta[property="og:description"]', 'content', desc);
        setMeta('meta[name="twitter:title"]', 'content', fullTitle);
        setMeta('meta[name="twitter:description"]', 'content', desc);

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
    }, [fullTitle, desc, jsonLd]);

    return null;
}
