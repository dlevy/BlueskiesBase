// YouTube helpers shared by the show prerender (showMeta.js), the show save
// routes (routes/shows.js) and the one-time backfill script.

// Mirrors getYouTubeId in client/src/pages/ShowDetailPage.jsx — keep in sync.
// Playlist links (no ?v=) return null: they aren't a single video.
function getYouTubeId(url) {
    try {
        const u = new URL(url);
        if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
        if (u.hostname.includes('youtube.com')) {
            if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
            return u.searchParams.get('v');
        }
    } catch {}
    return null;
}

// A video's real publish date, read from its public watch page (which embeds
// it as <meta itemprop="uploadDate">) — no API key needed. Returns an ISO
// string, or null when the video is gone/private or the page can't be read.
async function fetchYouTubeUploadDate(videoId) {
    try {
        const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkySetsBot/1.0)', 'Accept-Language': 'en' },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const html = await res.text();
        const m = html.match(/itemprop="uploadDate" content="([^"]+)"/)
            || html.match(/"uploadDate":"([^"]+)"/);
        if (!m || Number.isNaN(Date.parse(m[1]))) return null;
        return m[1];
    } catch {
        return null;
    }
}

// Fills in `upload_date` (and `upload_video_id`, the video it belongs to) on
// every YouTube link that doesn't already have one for its current URL — so
// editing a link to point at a different video refetches. Non-YouTube links
// and links whose date can't be found come back without either field.
async function withYouTubeUploadDates(links) {
    if (!Array.isArray(links)) return links;
    return Promise.all(links.map(async link => {
        const ytId = getYouTubeId(link?.url);
        const { upload_date, upload_video_id, ...rest } = link || {};
        if (!ytId) return rest;
        if (upload_date && upload_video_id === ytId) return link;
        const date = await fetchYouTubeUploadDate(ytId);
        return date ? { ...rest, upload_date: date, upload_video_id: ytId } : rest;
    }));
}

// The upload date to publish in VideoObject JSON-LD — only when it was
// fetched for this exact video.
function uploadDateFor(link, ytId) {
    return link?.upload_date && link.upload_video_id === ytId ? link.upload_date : null;
}

module.exports = { getYouTubeId, fetchYouTubeUploadDate, withYouTubeUploadDates, uploadDateFor };
