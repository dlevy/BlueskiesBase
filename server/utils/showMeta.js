const { supabase } = require('../config/supabase');

// Must match client/src/utils/showSlug.js and server/routes/sitemap.js.
function slugify(str) {
    return (str || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Mirrors the matching logic in GET /api/shows/lookup — finds the show behind
// a /show/:artist/:date/:location URL, for server-side meta tag injection.
async function findShowByPathParams({ artist, date, location }) {
    const { data: shows, error } = await supabase
        .from('shows')
        .select('id, artist_name, show_date, tour_name, venues(name, city, state_country)')
        .eq('show_date', date);

    if (error || !shows) return null;

    return shows.find(s => {
        const artistSlug = slugify(s.artist_name);
        const citySlug = slugify(s.venues?.city || '');
        const stateSlug = slugify(s.venues?.state_country || '');
        const locationSlug = [citySlug, stateSlug].filter(Boolean).join('-');
        return artistSlug === artist && locationSlug === location;
    }) || null;
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Builds the title/description/JSON-LD for a show, for both the client-side
// <SEO> component and this server-side prerender path — keep the two in sync
// (client/src/pages/ShowDetailPage.jsx builds the same shape for logged-in
// browser navigation, where this server-rendered version isn't used again).
function buildShowHead(show) {
    const venueName = show.venues?.name || '';
    const venueCity = show.venues
        ? `${show.venues.city}${show.venues.state_country ? ', ' + show.venues.state_country : ''}`
        : '';
    const [y, m, d] = show.show_date.split('-');
    const longDate = new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const title = `${show.artist_name} at ${venueName} – ${longDate} Setlist | SkySets.org`;
    const description = `${show.artist_name} performed at ${venueName} in ${venueCity} on ${longDate}.`;

    // No ticketing/promoter data exists in this archive (it's a historical
    // setlist database, not a ticketing site) — deliberately not fabricating
    // `offers` or `organizer`, since inventing those would violate Google's
    // structured data guidelines.
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'MusicEvent',
        name: `${show.artist_name} – ${venueName}`,
        startDate: show.show_date,
        endDate: show.show_date,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        description,
        location: {
            '@type': 'MusicVenue',
            name: venueName,
            address: {
                '@type': 'PostalAddress',
                addressLocality: show.venues?.city,
                addressRegion: show.venues?.state_country,
            },
        },
        performer: { '@type': 'MusicGroup', name: show.artist_name },
        ...(show.tour_name ? { subEvent: { '@type': 'Event', name: show.tour_name } } : {}),
    };

    return { title, description, jsonLd };
}

// Injects title/description/og/twitter/JSON-LD into the built index.html for
// a single show, so crawlers that don't execute JS (or time out before the
// client's useEffect-based <SEO> component runs) still see correct Event
// structured data. Replaces the template's default SEO tags by their known
// literal content rather than appending duplicates.
function injectShowHead(html, show) {
    const { title, description, jsonLd } = buildShowHead(show);
    const escTitle = escapeHtml(title);
    const escDesc = escapeHtml(description);

    let out = html
        .replace(
            /<title>[^<]*<\/title>/,
            `<title>${escTitle}</title>`
        )
        .replace(
            /<meta name="description" content="[^"]*" \/>/,
            `<meta name="description" content="${escDesc}" />`
        )
        .replace(
            /<meta property="og:title" content="[^"]*" \/>/,
            `<meta property="og:title" content="${escTitle}" />`
        )
        .replace(
            /<meta property="og:description" content="[^"]*" \/>/,
            `<meta property="og:description" content="${escDesc}" />`
        )
        .replace(
            /<meta name="twitter:title" content="[^"]*" \/>/,
            `<meta name="twitter:title" content="${escTitle}" />`
        )
        .replace(
            /<meta name="twitter:description" content="[^"]*" \/>/,
            `<meta name="twitter:description" content="${escDesc}" />`
        );

    const jsonLdScript = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`;
    out = out.replace('</head>', jsonLdScript);

    return out;
}

module.exports = { findShowByPathParams, buildShowHead, injectShowHead };
