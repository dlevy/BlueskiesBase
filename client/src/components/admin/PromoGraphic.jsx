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

export const PROMO_SIZE = 1080;
const SIDE_PADDING = 64;

function formatLongDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });
}

const PromoGraphic = forwardRef(function PromoGraphic({ show, backgroundImageUrl }, ref) {
    const location = show.venues
        ? [show.venues.city, show.venues.state_country].filter(Boolean).join(', ')
        : null;

    return (
        <div
            ref={ref}
            style={{
                position: 'relative',
                width: PROMO_SIZE,
                height: PROMO_SIZE,
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

            {/* Scrim — darkest at the bottom where the text block sits, light
                enough up top that the background image still reads. */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(3,4,7,0.35) 0%, rgba(3,4,7,0.3) 40%, rgba(3,4,7,0.82) 75%, rgba(3,4,7,0.94) 100%)',
            }} />

            {/* Content — bottom-anchored text block */}
            <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                alignItems: 'center', textAlign: 'center',
                paddingLeft: SIDE_PADDING, paddingRight: SIDE_PADDING, paddingBottom: 72,
                boxSizing: 'border-box',
                color: PALETTE.body, textShadow: TEXT_SHADOW,
            }}>
                {show.tour_name && (
                    <div style={{
                        fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                        color: PALETTE.accent, marginBottom: 14,
                    }}>
                        {show.tour_name}
                    </div>
                )}
                <div style={{
                    fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
                    fontWeight: 700, fontSize: 68, lineHeight: 1.1, color: PALETTE.heading, marginBottom: 18,
                }}>
                    {show.artist_name}
                </div>
                {show.venues?.name && (
                    <div style={{ fontSize: 36, fontWeight: 600, color: PALETTE.heading, marginBottom: 4 }}>
                        {show.venues.name}
                    </div>
                )}
                {location && (
                    <div style={{ fontSize: 30, fontWeight: 500, color: PALETTE.body, marginBottom: 14 }}>
                        {location}
                    </div>
                )}
                <div style={{ fontSize: 28, color: PALETTE.muted }}>
                    {formatLongDate(show.show_date)}
                </div>
            </div>
        </div>
    );
});

export default PromoGraphic;
