import { forwardRef } from 'react';

// Fixed-pixel-size square graphic (1080x1080), captured via html-to-image —
// a simpler sibling of InstagramPostGraphic.jsx: no setlist, no color-style
// picker, no SkySets branding. Background is always an image (a show poster
// or the default artwork) composited at an adjustable opacity directly over
// a solid black ground — not a variable-strength dark overlay drawn on top
// of a fully-opaque image. Text sits inside two solid black bars (top and
// bottom, independently adjustable opacity via `barOpacity`) rather than
// directly on the image, so legibility doesn't depend on `posterOpacity` —
// text always renders at full opacity/color, with a text-shadow as a second
// safety margin for whatever shows through a bar at a low barOpacity.
// `bgPosX`/`bgPosY` (0-100, percent) and `bgZoom` let the background image be
// panned/zoomed within the fixed square, same idea as a crop tool. The base
// size (bgZoom=1) is `background-size: contain` — the whole image always
// visible, letterboxed/pillarboxed as needed — not `cover`, which would
// silently crop a poster whose aspect ratio doesn't match the square before
// the user ever gets a chance to zoom/pan; bgZoom then scales up from there
// via a CSS transform to crop in only when asked.
const PALETTE = {
    heading: '#ffffff',
    body: 'rgba(255,255,255,0.92)',
    muted: 'rgba(255,255,255,0.72)',
    accent: '#fbbf24',
};
const TEXT_SHADOW = '0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.7)';
const HEADING_FONT_STACK = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";

export const ARTWORK_SIZE = 1080;
const SIDE_PADDING = 64;

function formatLongDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });
}

const ArtworkGraphic = forwardRef(function ArtworkGraphic({
    show, backgroundImageUrl, posterOpacity = 0.5, barOpacity = 0.7,
    bgPosX = 50, bgPosY = 50, bgZoom = 1,
}, ref) {
    const location = show.venues
        ? [show.venues.city, show.venues.state_country].filter(Boolean).join(', ')
        : null;

    // Full-bleed solid bar behind a text group — one continuous rectangle
    // (not per-line) so there's no gap in the bar between the lines it
    // covers, with its own horizontal padding standing in for the side
    // padding the outer content box no longer has (see below).
    const barStyle = {
        width: '100%', background: `rgba(0,0,0,${barOpacity})`,
        paddingLeft: SIDE_PADDING, paddingRight: SIDE_PADDING, paddingTop: 36, paddingBottom: 36,
        boxSizing: 'border-box',
    };

    return (
        <div
            ref={ref}
            style={{
                position: 'relative',
                width: ARTWORK_SIZE,
                height: ARTWORK_SIZE,
                background: '#000000',
                fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
                boxSizing: 'border-box',
                overflow: 'hidden',
            }}
        >
            {backgroundImageUrl && (
                <div
                    role="img"
                    aria-label=""
                    style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url("${backgroundImageUrl}")`,
                        backgroundSize: 'contain',
                        backgroundPosition: `${bgPosX}% ${bgPosY}%`,
                        backgroundRepeat: 'no-repeat',
                        opacity: posterOpacity,
                        transform: `scale(${bgZoom})`,
                        transformOrigin: `${bgPosX}% ${bgPosY}%`,
                    }}
                />
            )}

            {/* Content — a full-width black bar behind tour/band, flush
                against the very top of the canvas, and another behind
                venue/location/date, flush against the very bottom, poster
                showing through the gap between them. No padding on this
                outer box at all — each bar supplies its own horizontal
                padding, and sitting flush top/bottom is the point. */}
            <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                alignItems: 'center', textAlign: 'center',
                boxSizing: 'border-box',
                color: PALETTE.body, textShadow: TEXT_SHADOW,
            }}>
                <div style={barStyle}>
                    {show.tour_name && (
                        <div style={{
                            fontSize: 32, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                            color: PALETTE.accent, marginBottom: 14,
                        }}>
                            {show.tour_name}
                        </div>
                    )}
                    <div style={{
                        fontFamily: HEADING_FONT_STACK,
                        fontWeight: 700, fontSize: 68, lineHeight: 1.1, color: PALETTE.heading,
                    }}>
                        {show.artist_name}
                    </div>
                </div>

                <div style={barStyle}>
                    {location && (
                        <div style={{ fontFamily: HEADING_FONT_STACK, fontSize: 48, fontWeight: 600, textTransform: 'uppercase', color: PALETTE.body, marginBottom: 4 }}>
                            {location}
                        </div>
                    )}
                    {show.venues?.name && (
                        <div style={{ fontSize: 28, fontWeight: 600, textTransform: 'uppercase', color: PALETTE.heading, marginBottom: 8 }}>
                            {show.venues.name}
                        </div>
                    )}
                    <div style={{ fontFamily: HEADING_FONT_STACK, fontSize: 48, fontWeight: 600, textTransform: 'uppercase', color: PALETTE.muted }}>
                        {formatLongDate(show.show_date)}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ArtworkGraphic;
