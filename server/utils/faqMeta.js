const faq = require('../data/faq.json');

// Server-side prerender for /faq, for crawlers that don't execute JS (most AI
// crawlers): without it they get an empty <div id="root">, no FAQ text and no
// FAQPage JSON-LD. Same index.html-rewriting approach as showMeta.js.

const SITE_NAME = 'SkySets.org';

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Must produce exactly what client/src/pages/FaqPage.jsx builds, since the
// client's <SEO> reuses the script tag this prerender emits.
function buildFaqJsonLd() {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.sections.flatMap(section =>
            section.items.map(({ q, a }) => ({
                '@type': 'Question',
                name: q,
                acceptedAnswer: { '@type': 'Answer', text: a },
            }))
        ),
    };
}

function injectFaqHtml(html, baseUrl) {
    const title = escapeHtml(`${faq.title} | ${SITE_NAME}`);
    const desc = escapeHtml(faq.description);
    const canonicalUrl = escapeHtml(`${baseUrl}/faq`);

    let out = html
        .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
        .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${desc}" />`)
        .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonicalUrl}" />`)
        .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`)
        .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${desc}" />`)
        .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonicalUrl}" />`)
        .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title}" />`)
        .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${desc}" />`);

    // id matches SEO.jsx's, so once React mounts it updates this tag in place
    // instead of appending a second, duplicate FAQPage block. "<" is escaped so
    // answer text can never close the script element early.
    const jsonLd = JSON.stringify(buildFaqJsonLd()).replace(/</g, '\\u003c');
    out = out.replace('</head>', `<script id="json-ld-seo" type="application/ld+json">${jsonLd}</script>\n  </head>`);

    // <noscript>, not prefilled #root: React replaces #root's children on mount,
    // so prefilled content would flash and shift the layout for real visitors.
    const answerHtml = (a, links) => Object.entries(links || {}).reduce(
        (html, [phrase, url]) => html.replace(escapeHtml(phrase), `<a href="${escapeHtml(url)}">${escapeHtml(phrase)}</a>`),
        escapeHtml(a)
    );
    const body = faq.sections.map(section =>
        `<section><h2>${escapeHtml(section.heading)}</h2>`
        + section.items.map(({ q, a, links }) => `<h3>${escapeHtml(q)}</h3><p>${answerHtml(a, links)}</p>`).join('')
        + '</section>'
    ).join('');
    out = out.replace(
        '<div id="root"></div>',
        `<div id="root"></div>\n    <noscript><main><h1>Frequently Asked Questions</h1>${body}</main></noscript>`
    );

    return out;
}

module.exports = { buildFaqJsonLd, injectFaqHtml };
