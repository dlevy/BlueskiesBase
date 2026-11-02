import { PTag } from '@porsche-design-system/components-react';

// Neutral color for "this show has X" content indicators (Video, Links,
// Comments, Photos, Poster) — one family rather than a rainbow of unrelated
// colors. The count tags below reuse the same colors already established
// for these concepts elsewhere (ShowDetailPage's stat tiles, SetlistPreview's
// debut tags), so a show reads the same way wherever it's summarized.
const CONTENT_TAG_COLOR = '#9ca3af';
const COVER_COLOR = '#60a5fa';
const TEASE_COLOR = '#fbbf24';
const RARE_COLOR = '#c084fc';
const TOUR_DEBUT_COLOR = '#22d3ee';
const LIVE_DEBUT_COLOR = '#34d399';

function Tag({ label, color }) {
    return (
        <span
            className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
        >
            {label}
        </span>
    );
}

/**
 * Shared "what's on this show" tag row for every place a show is listed
 * without its full setlist — homepage most-recent/next-show widgets, search
 * results. No song titles, just counts and content indicators, so the same
 * show reports the same things wherever it's summarized instead of songs in
 * one place and tags in another.
 */
export default function ShowTagsRow({
    className = '',
    isCancelled, openedFor, hasVideo, hasLinks, hasNotes, hasPhotos, hasPoster,
    coverCount = 0, teaseCount = 0, rareCount = 0, tourDebutCount = 0, liveDebutCount = 0,
}) {
    const hasAny = isCancelled || openedFor || hasVideo || hasLinks || hasNotes || hasPhotos || hasPoster ||
        coverCount > 0 || teaseCount > 0 || rareCount > 0 || tourDebutCount > 0 || liveDebutCount > 0;
    if (!hasAny) return null;

    return (
        <div className={`flex flex-wrap gap-1.5 ${className}`}>
            {isCancelled && <PTag color="notification-error-soft">Canceled</PTag>}
            {openedFor && <PTag color="notification-warning-soft">Opening for {openedFor}</PTag>}
            {hasVideo && <Tag label="Video" color={CONTENT_TAG_COLOR} />}
            {hasLinks && <Tag label="Links" color={CONTENT_TAG_COLOR} />}
            {hasNotes && <Tag label="Comments" color={CONTENT_TAG_COLOR} />}
            {hasPhotos && <Tag label="Photos" color={CONTENT_TAG_COLOR} />}
            {hasPoster && <Tag label="Poster" color={CONTENT_TAG_COLOR} />}
            {coverCount > 0 && <Tag label={`${coverCount} Cover${coverCount !== 1 ? 's' : ''}`} color={COVER_COLOR} />}
            {teaseCount > 0 && <Tag label={`${teaseCount} Tease${teaseCount !== 1 ? 's' : ''}`} color={TEASE_COLOR} />}
            {rareCount > 0 && <Tag label={`${rareCount} Rare Song${rareCount !== 1 ? 's' : ''}`} color={RARE_COLOR} />}
            {tourDebutCount > 0 && <Tag label={`${tourDebutCount} Tour Debut${tourDebutCount !== 1 ? 's' : ''}`} color={TOUR_DEBUT_COLOR} />}
            {liveDebutCount > 0 && <Tag label={`${liveDebutCount} Live Debut${liveDebutCount !== 1 ? 's' : ''}`} color={LIVE_DEBUT_COLOR} />}
        </div>
    );
}
