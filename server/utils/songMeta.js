const { supabase } = require('../config/supabase');
const { computeSetlistIndex } = require('./setlistIndex');

// Must match client/src/utils/songSlug.js (and the show/tour slug copies in
// showSlug.js, tourSlug.js, showMeta.js, tourMeta.js, server/routes/sitemap.js).
function slugify(str) {
    return (str || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildSongPath(title) {
    return `/songs/${slugify(title)}`;
}

// Resolves a /songs/:songSlug URL segment to a real song, then its
// performance count from the shared cached setlist index (the same one
// GET /api/songs uses) — cheap, no need to re-run the heavier paginated
// performances query GET /api/songs/:id does for the full in-app page.
//
// A slug matching more than one distinct song (e.g. two different songs
// both titled "Machine Gun") is treated the same as zero matches — a
// data-entry collision, not something worth guessing at.
async function findSongByUrlSlug(songSlug) {
    const { data: allSongs, error: listError } = await supabase
        .from('songs')
        .select('id, title');
    if (listError || !allSongs) return null;

    const normalizedSlug = slugify(songSlug);
    const matches = allSongs.filter(s => slugify(s.title) === normalizedSlug);
    if (matches.length !== 1) {
        if (matches.length > 1) {
            console.warn(`[songMeta] Slug "${songSlug}" matches ${matches.length} distinct songs: ${matches.map(s => s.title).join(', ')}`);
        }
        return null;
    }

    const { data: song, error: songError } = await supabase
        .from('songs')
        .select('id, title, lyrics, is_original, original_artist, written_by, is_sunday_valley, album_songs(albums(title, release_date))')
        .eq('id', matches[0].id)
        .single();
    if (songError || !song) return null;

    const index = await computeSetlistIndex();
    const performanceCount = index.showIdsBySong.get(song.id)?.size || 0;

    return { song, performanceCount };
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function albumYear(releaseDate) {
    return releaseDate ? releaseDate.split('-')[0] : '';
}

// Must match songAlbums in client/src/pages/SongLyricsPage.jsx — a song can
// officially appear on more than one release, so this lists every one it's
// actually on rather than picking a single "primary" album.
function songAlbums(song) {
    return (song.album_songs || [])
        .map(as => as.albums)
        .filter(Boolean)
        .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''));
}

// title/description/JSON-LD for a song's lyrics page. MusicComposition.lyrics
// is the schema.org-documented shape for exactly this. composer is only
// included when we actually know who wrote it (written_by, or original_artist
// for a cover) — never fabricated, same rule already applied to show/tour
// JSON-LD elsewhere in this codebase.
function buildSongHead(song, performanceCount, { canonicalUrl, baseUrl } = {}) {
    const isCover = song.is_original === false;
    const albums = songAlbums(song);
    const albumsText = albums.map(a => `${a.title} (${albumYear(a.release_date)})`).join(', ');
    const title = `${song.title} Lyrics | SkySets.org`;
    const description = `Lyrics for "${song.title}"`
        + (isCover && song.original_artist ? ` (originally by ${song.original_artist})` : '')
        + (albums.length > 0 ? `, from ${albumsText}` : '')
        + `, performed live by Johnny Blue Skies & The Dark Clouds and Sturgill Simpson.`
        + (performanceCount > 0 ? ` Played ${performanceCount} time${performanceCount === 1 ? '' : 's'}.` : '');

    const composerName = song.written_by || (isCover ? song.original_artist : null);

    const musicCompositionJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'MusicComposition',
        name: song.title,
        ...(song.lyrics ? { lyrics: { '@type': 'CreativeWork', text: song.lyrics } } : {}),
        ...(composerName ? { composer: { '@type': 'Person', name: composerName } } : {}),
    };

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
            { '@type': 'ListItem', position: 2, name: 'Discography', item: `${baseUrl}/discography` },
            { '@type': 'ListItem', position: 3, name: `${song.title} Lyrics`, item: canonicalUrl },
        ],
    };

    return { title, description, jsonLd: [musicCompositionJsonLd, breadcrumbJsonLd] };
}

// Same tag-rewriting approach as showMeta.js/tourMeta.js, plus a full
// <noscript> dump of the actual lyrics text — the one thing a non-JS
// crawler most needs here, same reasoning as faqMeta.js's own <noscript>.
function injectSongHead(html, song, performanceCount, baseUrl) {
    const canonicalUrl = `${baseUrl}${buildSongPath(song.title)}`;
    const { title, description, jsonLd } = buildSongHead(song, performanceCount, { canonicalUrl, baseUrl });
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

    const tagsHtml = [
        song.is_original === false ? `Cover${song.original_artist ? ` of ${escapeHtml(song.original_artist)}` : ''}` : null,
        song.is_sunday_valley ? 'Sunday Valley' : null,
    ].filter(Boolean).join(' &middot; ');
    const lyricsHtml = song.lyrics
        ? `<pre>${escapeHtml(song.lyrics)}</pre>`
        : `<p>Lyrics not available yet.</p>`;
    const performanceHtml = performanceCount > 0
        ? `<p>Played ${performanceCount} time${performanceCount === 1 ? '' : 's'} live.</p>`
        : '';
    const albums = songAlbums(song);
    const albumsHtml = albums.length > 0
        ? `<p>On ${escapeHtml(albums.map(a => `${a.title} (${albumYear(a.release_date)})`).join(', '))}</p>`
        : '';
    const body = `<h1>${escapeHtml(song.title)} Lyrics</h1>`
        + (tagsHtml ? `<p>${tagsHtml}</p>` : '')
        + albumsHtml
        + lyricsHtml
        + performanceHtml;
    out = out.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript><main>${body}</main></noscript>`);

    return out;
}

module.exports = { slugify, buildSongPath, findSongByUrlSlug, buildSongHead, injectSongHead };
