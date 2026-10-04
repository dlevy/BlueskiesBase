import { forwardRef } from 'react';

// Fixed-pixel-size square graphic (1080x1080), captured via html-to-image —
// a simpler sibling of InstagramPostGraphic.jsx: no setlist, no color-style
// picker, no SkySets branding. Background is always an image (a show poster
// or the default artwork), so it always uses this fixed high-contrast
// overlay palette rather than a tour color style — an arbitrary poster/photo
// can't be assumed to work with any given palette. Paired with a dark scrim
// and a text-shadow on every text layer so legibility never depends on which
// part of the image sits behind a line of text.
const PALETTE = {
    heading: '#ffffff',
    body: 'rgba(255,255,255,0.92)',
    muted: 'rgba(255,255,255,0.72)',
    accent: '#fbbf24',
};
const TEXT_SHADOW = '0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.7)';

export const ARTWORK_SIZE = 1080;
const SIDE_PADDING = 64;

function formatLongDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });
}

// Scrim alpha at each gradient stop, at the slider's full-dark end (1.0) —
// actual rendered alpha is this times `overlayOpacity` (0.2-0.8, see
// ArtworkPage.jsx's slider), so the shape stays the same at every setting
// and only the overall darkness scales.
const SCRIM_STOPS = { top: 0.9, midTop: 0.25, midBottom: 0.22, bottom: 1 };

const ArtworkGraphic = forwardRef(function ArtworkGraphic({ show, backgroundImageUrl, overlayOpacity = 0.5 }, ref) {
    const location = show.venues
        ? [show.venues.city, show.venues.state_country].filter(Boolean).join(', ')
        : null;
    const scrim = (stop) => (stop * overlayOpacity).toFixed(2);

    return (
        <div
            ref={ref}
            style={{
                position: 'relative',
                width: ARTWORK_SIZE,
                height: ARTWORK_SIZE,
                background: '#0b0e13',
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
                        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                    }}
                />
            )}

            {/* Scrim — dark at top (behind tour/band) and bottom (behind
                venue/location/date), lighter through the middle so the poster
                itself reads more clearly there. Overall darkness is user-
                adjustable (see overlayOpacity/SCRIM_STOPS above). */}
            <div style={{
                position: 'absolute', inset: 0,
                background: `linear-gradient(180deg, rgba(3,4,7,${scrim(SCRIM_STOPS.top)}) 0%, rgba(3,4,7,${scrim(SCRIM_STOPS.midTop)}) 28%, rgba(3,4,7,${scrim(SCRIM_STOPS.midBottom)}) 58%, rgba(3,4,7,${scrim(SCRIM_STOPS.bottom)}) 100%)`,
            }} />

            {/* Content — tour/band up top, venue/location/date at the bottom,
                poster showing through the gap between them. */}
            <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                alignItems: 'center', textAlign: 'center',
                paddingLeft: SIDE_PADDING, paddingRight: SIDE_PADDING, paddingTop: 72, paddingBottom: 72,
                boxSizing: 'border-box',
                color: PALETTE.body, textShadow: TEXT_SHADOW,
            }}>
                <div>
                    {show.tour_name && (
                        <div style={{
                            fontSize: 32, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                            color: PALETTE.accent, marginBottom: 14,
                        }}>
                            {show.tour_name}
                        </div>
                    )}
                    <div style={{
                        fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
                        fontWeight: 700, fontSize: 68, lineHeight: 1.1, color: PALETTE.heading,
                    }}>
                        {show.artist_name}
                    </div>
                </div>

                <div>
                    {location && (
                        <div style={{ fontSize: 48, fontWeight: 600, textTransform: 'uppercase', color: PALETTE.body, marginBottom: 10 }}>
                            {location}
                        </div>
                    )}
                    {show.venues?.name && (
                        <div style={{ fontSize: 28, fontWeight: 600, textTransform: 'uppercase', color: PALETTE.heading, marginBottom: 18 }}>
                            {show.venues.name}
                        </div>
                    )}
                    <div style={{ fontSize: 48, fontWeight: 600, textTransform: 'uppercase', color: PALETTE.muted }}>
                        {formatLongDate(show.show_date)}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ArtworkGraphic;
