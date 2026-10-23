const { supabase } = require('../config/supabase');

// Must match client/src/utils/showSlug.js and server/routes/sitemap.js.
function slugify(str) {
    return (str || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Mirrors buildShowPath in client/src/utils/showSlug.js and server/routes/sitemap.js.
function buildShowPath(show) {
    const artist = slugify(show.artist_name);
    const date = show.show_date;
    const location = [slugify(show.venues?.city), slugify(show.venues?.state_country)]
        .filter(Boolean)
        .join('-');
    return `/show/${artist}/${date}/${location}`;
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

// An image for this show's JSON-LD (schema.org MusicEvent.image, which
// Google ties to Event rich-result eligibility) — the official poster if one
// exists, else the earliest fan photo, else none (never fabricated). Mirrors
// client/src/pages/ShowDetailPage.jsx's own poster-then-photo fallback for
// in-app navigation.
async function findShowImageUrl(showId) {
    const { data: posterLinks } = await supabase
        .from('poster_show_links')
        .select('user_posters ( poster_url, is_foil, is_primary )')
        .eq('show_id', showId);
    const posters = (posterLinks || []).map(l => l.user_posters).filter(Boolean);
    const primaryPoster = posters.find(p => !p.is_foil && p.is_primary) || posters[0];
    if (primaryPoster) return primaryPoster.poster_url;

    const { data: photos } = await supabase
        .from('user_photos')
        .select('photo_url')
        .eq('show_id', showId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1);
    return photos?.[0]?.photo_url || null;
}

// Builds the title/description/JSON-LD for a show, for both the client-side
// <SEO> component and this server-side prerender path — keep the two in sync
// (client/src/pages/ShowDetailPage.jsx builds the same shape for logged-in
// browser navigation, where this server-rendered version isn't used again).
// `imageUrl`/`canonicalUrl`/`baseUrl` are resolved by the caller (injectShowHead)
// since they each need their own async fetch or request-derived base — this
// function itself stays a plain sync builder.
function buildShowHead(show, { imageUrl, canonicalUrl, baseUrl } = {}) {
    const venueName = show.venues?.name || '';
    const venueCity = show.venues
        ? `${show.venues.city}${show.venues.state_country ? ', ' + show.venues.state_country : ''}`
        : '';
    const [y, m, d] = show.show_date.split('-');
    const longDate = new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const title = `${show.artist_name} at ${venueName} – ${longDate} Setlist | SkySets.org`;
    const description = `${show.artist_name} performed at ${venueName} in ${venueCity} on ${longDate}.`
        + (show.tour_name ? ` Part of the ${show.tour_name} tour.` : '');

    // No ticketing/promoter data exists in this archive (it's a historical
    // setlist database, not a ticketing site) — deliberately not fabricating
    // `offers` or `organizer`, since inventing those would violate Google's
    // structured data guidelines.
    //
    // Tour name is folded into `description` rather than modeled as
    // `subEvent` — a tour isn't a sub-event contained within this show (the
    // relationship schema.org's subEvent describes), and worse, nesting it
    // as its own `@type: Event` object makes Google validate *that* object
    // against the same required-fields rules, which it can never satisfy
    // (a tour spans many dates/venues, not one).
    const musicEventJsonLd = {
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
        ...(imageUrl ? { image: imageUrl } : {}),
    };

    // No deep-linkable per-tour URL exists on the public site today (the
    // Tour Stats page's tour picker is local state, not reflected in the
    // URL) — the tour breadcrumb item links to the general /tour-stats page
    // rather than a URL that would actually land on this specific tour,
    // the same loose "category page" pattern many sites use for a
    // breadcrumb segment that isn't itself a dedicated page per value.
    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
            ...(show.tour_name ? [{ '@type': 'ListItem', position: 2, name: show.tour_name, item: `${baseUrl}/tour-stats` }] : []),
            {
                '@type': 'ListItem',
                position: show.tour_name ? 3 : 2,
                name: title.replace(' | SkySets.org', ''),
                item: canonicalUrl,
            },
        ],
    };

    return { title, description, jsonLd: [musicEventJsonLd, breadcrumbJsonLd] };
}

// Injects title/description/canonical/og/twitter/JSON-LD into the built
// index.html for a single show, so crawlers that don't execute JS (or time
// out before the client's useEffect-based <SEO> component runs) still see
// correct Event structured data — and, critically, the show's own canonical
// URL rather than the static homepage one index.html ships with by default.
// Replaces the template's default SEO tags by their known literal content
// rather than appending duplicates. `baseUrl` is this request's own origin
// (see utils/baseUrl.js) — reused rather than hardcoded so the canonical
// always matches whatever host actually served the sitemap too.
async function injectShowHead(html, show, baseUrl) {
    const rawCanonicalUrl = baseUrl + buildShowPath(show);
    const imageUrl = await findShowImageUrl(show.id);
    const { title, description, jsonLd } = buildShowHead(show, { imageUrl, canonicalUrl: rawCanonicalUrl, baseUrl });
    const escTitle = escapeHtml(title);
    const escDesc = escapeHtml(description);
    const canonicalUrl = escapeHtml(rawCanonicalUrl);

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
            /<link rel="canonical" href="[^"]*" \/>/,
            `<link rel="canonical" href="${canonicalUrl}" />`
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
            /<meta property="og:url" content="[^"]*" \/>/,
            `<meta property="og:url" content="${canonicalUrl}" />`
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
