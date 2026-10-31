const { supabase } = require('../config/supabase');

// Must match client/src/utils/tourSlug.js (and the show-slug copies in
// client/src/utils/showSlug.js, server/utils/showMeta.js, server/routes/sitemap.js).
function slugify(str) {
    return (str || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildTourPath(tourName) {
    return `/tours/${slugify(tourName)}`;
}

function songLabel(row) {
    const title = row.songs?.title;
    if (!title) return null;
    let label = title;
    if (row.jams_into) label += ' →';
    if (row.performance_type === 'tease') label += ' (tease)';
    else if (row.performance_type === 'partial') label += ' (partial)';
    return label;
}

// Resolves a /tours/:tourSlug URL segment to a real tour_name, then fetches
// every show on that tour plus (for already-played ones) their full, ordered
// setlists. Mirrors the two-step resolution client/src/pages/TourPage.jsx
// does client-side, duplicated here since this is CJS/service-role server
// code that can't import tourSongCounts.js (browser Supabase client).
//
// A slug matching more than one distinct tour_name — two hand-entered tour
// names differing only in punctuation/case that slugify collapses together —
// is treated the same as zero matches (returns null) rather than guessing;
// that's a data-entry collision, not a legitimate ambiguity worth resolving.
async function findTourByUrlSlug(tourSlug) {
    let tourNames = [];
    for (let rangeStart = 0; ;) {
        const { data: page, error } = await supabase
            .from('shows')
            .select('tour_name')
            .not('tour_name', 'is', null)
            .neq('tour_name', '')
            .order('id')
            .range(rangeStart, rangeStart + 999);
        if (error || !page?.length) break;
        tourNames = tourNames.concat(page.map(r => r.tour_name));
        if (page.length < 1000) break;
        rangeStart += 1000;
    }

    const distinctNames = [...new Set(tourNames)];
    const normalizedSlug = slugify(tourSlug);
    const matches = distinctNames.filter(name => slugify(name) === normalizedSlug);
    if (matches.length !== 1) {
        if (matches.length > 1) {
            console.warn(`[tourMeta] Slug "${tourSlug}" matches ${matches.length} distinct tour names: ${matches.join(', ')}`);
        }
        return null;
    }
    const tourName = matches[0];

    const { data: shows, error: showsError } = await supabase
        .from('shows')
        .select('id, show_date, artist_name, venues(name, city, state_country)')
        .eq('tour_name', tourName)
        .order('show_date', { ascending: true })
        .order('day_order', { ascending: true })
        .order('id');
    if (showsError || !shows?.length) return null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const pastShows = shows.filter(s => s.show_date <= todayStr);
    const upcomingShows = shows.filter(s => s.show_date > todayStr);

    // Same shape as fetchTourSetlistRows in client/src/utils/tourSongCounts.js,
    // scoped to this one already-known tour_name — teases are kept (this is
    // the setlist as actually performed, not a tally), dj/soundcheck excluded.
    let setlistRows = [];
    for (let rangeStart = 0; ;) {
        const { data: page, error } = await supabase
            .from('setlist_songs')
            .select(`
                song_id, show_id, set_number, is_encore, song_order, performance_type, jams_into,
                songs!setlist_songs_song_id_fkey ( title ),
                shows!inner ( tour_name, show_date )
            `)
            .eq('shows.tour_name', tourName)
            .lte('shows.show_date', todayStr)
            .not('performance_type', 'in', '(dj,soundcheck)')
            .order('id')
            .range(rangeStart, rangeStart + 999);
        if (error || !page?.length) break;
        setlistRows = setlistRows.concat(page);
        if (page.length < 1000) break;
        rangeStart += 1000;
    }

    const orderKey = r => (r.is_encore ? 1 : 0) * 1000000 + (r.set_number ?? 0) * 10000 + (r.song_order ?? 0);
    const rowsByShow = {};
    setlistRows.forEach(r => { (rowsByShow[r.show_id] ||= []).push(r); });
    const setlistSongsByShow = {};
    Object.entries(rowsByShow).forEach(([showId, rows]) => {
        setlistSongsByShow[showId] = [...rows]
            .sort((a, b) => orderKey(a) - orderKey(b))
            .map(songLabel)
            .filter(Boolean);
    });

    return { tourName, pastShows, upcomingShows, setlistSongsByShow };
}

// title/description/breadcrumb for a tour page. No tour-as-Event JSON-LD —
// same reasoning already on record in showMeta.js's musicEventJsonLd comment:
// a tour spans many dates/venues and can never satisfy Google's single-Event
// required fields (startDate, location). This page's own URL is the
// breadcrumb's terminal item, since (unlike a show page, which links its
// tour segment out to this page) there's nowhere further to go.
function buildTourHead(tourName, pastShows, upcomingShows, { canonicalUrl, baseUrl } = {}) {
    const allShows = [...pastShows, ...upcomingShows];
    const firstDate = allShows[0]?.show_date;
    const lastDate = allShows[allShows.length - 1]?.show_date;
    const artistName = allShows[0]?.artist_name || '';
    const [fy, fm, fd] = (firstDate || '').split('-');
    const [ly, lm, ld] = (lastDate || '').split('-');
    const fmtShort = (y, m, d) => y ? new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const dateRange = firstDate === lastDate ? fmtShort(fy, fm, fd) : `${fmtShort(fy, fm, fd)} – ${fmtShort(ly, lm, ld)}`;

    const title = `${tourName} Tour Setlist | SkySets.org`;
    const description = `Every ${artistName} show and full setlist from the ${tourName} tour`
        + (dateRange ? ` (${dateRange})` : '') + `, ${pastShows.length} show${pastShows.length === 1 ? '' : 's'} played.`;

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
            { '@type': 'ListItem', position: 2, name: `${tourName} Tour Setlist`, item: canonicalUrl },
        ],
    };

    return { title, description, jsonLd: [breadcrumbJsonLd] };
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Must match client/src/utils/showSlug.js's buildShowPath.
function buildShowPath(show) {
    const artist = slugify(show.artist_name);
    const date = show.show_date;
    const location = [slugify(show.venues?.city), slugify(show.venues?.state_country)].filter(Boolean).join('-');
    return `/show/${artist}/${date}/${location}`;
}

function formatLongDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function venueLine(show) {
    if (!show.venues) return '';
    const { name, city, state_country } = show.venues;
    const cityState = [city, state_country].filter(Boolean).join(', ');
    return [name, cityState].filter(Boolean).join(', ');
}

// Same tag-rewriting approach as showMeta.js/faqMeta.js, plus a full
// <noscript> dump of every show's date/venue/setlist — most AI crawlers (and
// any crawler that doesn't wait for React to mount and fetch this page's
// data) never see anything else, same reasoning as faqMeta.js's own
// <noscript> block. Not prefilled into #root itself: React replaces #root's
// children on mount, so prefilled content would flash and shift layout for
// real visitors.
function injectTourHead(html, tourName, pastShows, upcomingShows, setlistSongsByShow, baseUrl) {
    const canonicalUrl = `${baseUrl}${buildTourPath(tourName)}`;
    const { title, description, jsonLd } = buildTourHead(tourName, pastShows, upcomingShows, { canonicalUrl, baseUrl });
    const escTitle = escapeHtml(title);
    const escDesc = escapeHtml(description);
    const escCanonical = escapeHtml(canonicalUrl);

    let out = html
        .replace(/<title>[^<]*<\/title>/, `<title>${escTitle}</title>`)
        .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escDesc}" />`)
        .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escCanonical}" />`)
        .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escTitle}" />`)
        .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escDesc}" />`)
        .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escCanonical}" />`)
        .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${escTitle}" />`)
        .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escDesc}" />`);

    const jsonLdScript = `<script id="json-ld-seo" type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>\n  </head>`;
    out = out.replace('</head>', jsonLdScript);

    const upcomingHtml = upcomingShows.length
        ? `<h2>Upcoming Shows</h2><ul>${upcomingShows.map(s =>
            `<li><a href="${escapeHtml(buildShowPath(s))}">${escapeHtml(formatLongDate(s.show_date))} — ${escapeHtml(venueLine(s))}</a></li>`
        ).join('')}</ul>`
        : '';
    const pastHtml = pastShows.length
        ? `<h2>Setlists</h2>${pastShows.map(s => {
            const songs = setlistSongsByShow[s.id] || [];
            return `<section><h3><a href="${escapeHtml(buildShowPath(s))}">${escapeHtml(formatLongDate(s.show_date))} — ${escapeHtml(venueLine(s))}</a></h3>`
                + (songs.length ? `<p>${escapeHtml(songs.join(', '))}</p>` : '')
                + `</section>`;
        }).join('')}`
        : '';
    const body = `<h1>${escapeHtml(tourName)} Tour Setlist</h1>${upcomingHtml}${pastHtml}`;
    out = out.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript><main>${body}</main></noscript>`);

    return out;
}

module.exports = { slugify, buildTourPath, findTourByUrlSlug, buildTourHead, injectTourHead };
