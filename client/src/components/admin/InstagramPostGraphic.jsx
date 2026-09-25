import { forwardRef } from 'react';
import { POST_WIDTH, POST_HEIGHT, getStyleByKey } from '../../utils/instagramStyles';

function formatLongDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });
}

const SET_KEYS = ['set1', 'set2', 'set3', 'encore'];

// Roughly how much vertical space the header + divider + footer (including
// the tagline beneath the footer link) take up — used to figure out how much
// room is actually left for the setlist so it fills the fixed 1080x1440 post
// instead of leaving empty bands top/bottom. Approximate on purpose: exact
// isn't the goal, but it needs to stay in the right ballpark, since the font
// size below is computed from this estimate, not measured from the real
// rendered header/footer.
const HEADER_FOOTER_OVERHEAD = 613;
const MAX_SONG_FONT = 34;

// Must match the actual rendered layout below (content padding, gap between
// the two columns, gap within a song row) — the width-fitting math needs the
// real pixel values, not estimates, since a fixed gap doesn't scale with font
// size the way text does.
const CONTENT_PADDING = 64;
const COLUMN_GAP = 56;
const ROW_GAP = 10;
const FONT_STACK = "'Inter', ui-sans-serif, system-ui, sans-serif";

// Canvas-based text measurement, reused across calls — lets the layout know
// the actual pixel width a title/number/badge will render at, rather than
// guessing, so font size can be shrunk exactly as far as needed and no
// further.
let measureCtx = null;
function measureTextWidth(text, fontSizePx, fontWeight) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = `${fontWeight} ${fontSizePx}px ${FONT_STACK}`;
    return measureCtx.measureText(text).width;
}

// Fixed high-contrast palette used when the background is an image (the show
// poster or an uploaded show photo) instead of a flat color — a tour's color
// style can't be trusted to read well over an arbitrary image, so image
// backgrounds always use this instead of the selected style's colors. Paired
// with a dark scrim over the image and a text-shadow on every text layer so
// legibility never depends on which part of the image sits behind a line of
// text.
const IMAGE_OVERLAY_PALETTE = {
    heading: '#ffffff',
    body: 'rgba(255,255,255,0.92)',
    muted: 'rgba(255,255,255,0.7)',
    accent: '#fbbf24',
    divider: 'rgba(255,255,255,0.35)',
};
const IMAGE_TEXT_SHADOW = '0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.7)';

function DebutTag({ label, color, songFontSize }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', flexShrink: 0,
            fontSize: Math.max(10, Math.round(songFontSize * 0.4)),
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            // Solid fill + near-black text, not a color-tinted background —
            // contrast this way comes from the pill itself, so it stays legible
            // whether the page behind it is a light or dark style, or a photo.
            color: '#0b0e13', background: color, borderRadius: 4, padding: '0.15em 0.5em',
        }}>
            {label}
        </span>
    );
}

// The widest a single song's row (number + title + any debut badges) can be
// at a given font size — a song's row never wraps (see the render below), so
// if this exceeds the column width the title gets ellipsis-truncated. Badge
// font size and padding are both proportional to songFontSize (see
// DebutTag), so their width scales with it too; only the flex gaps between
// elements are fixed pixel values that don't scale with font size.
function measureRowWidth(song, index, fontSize, liveDebutSongIds, tourDebutSongIds) {
    const numberWidth = measureTextWidth(`${index + 1}.`, fontSize, 400);
    const titleText = `${song.title}${song.jams_into ? ' →' : ''}`;
    const titleWidth = measureTextWidth(titleText, fontSize, 400);
    let width = numberWidth + ROW_GAP + titleWidth;

    const badgeFontSize = Math.max(10, Math.round(fontSize * 0.4));
    const isLiveDebut = song.song_id != null && liveDebutSongIds?.has(song.song_id);
    const isTourDebut = song.song_id != null && tourDebutSongIds?.has(song.song_id);
    [isLiveDebut && 'Live Debut', isTourDebut && 'Tour Debut'].filter(Boolean).forEach(label => {
        // DebutTag's own padding is '0.15em 0.5em' — 0.5em each side, 1em top/bottom half.
        const badgePadding = badgeFontSize; // 0.5em * 2 sides = 1em = badgeFontSize px
        width += ROW_GAP + measureTextWidth(label, badgeFontSize, 700) + badgePadding;
    });
    return width;
}

// Always two columns. The font has no minimum floor — it shrinks as far as
// necessary so every song fits, both vertically (within the available
// height) and horizontally (no title ellipsis-truncates within its column).
// A floor here is exactly what used to cause songs to get silently clipped
// off the top/bottom of long setlists, or individual titles to truncate —
// the row/row-height budget would be exceeded the moment the "readable
// minimum" size didn't actually fit.
function pickSongLayout(songs, availableHeight, columnWidth, liveDebutSongIds, tourDebutSongIds) {
    const usable = Math.max(availableHeight, 100);
    const columns = 2;
    const rows = Math.max(1, Math.ceil(songs.length / columns));
    const lineHeight = usable / rows;
    const heightFontSize = lineHeight / 1.45;

    // Binary-search the largest font size at which every song's row still
    // fits within columnWidth — badge width doesn't scale perfectly linearly
    // with font size (Math.max(10, Math.round(...)) floors/rounds it), so a
    // closed-form solve isn't reliable; a quick search is simpler and exact
    // enough at pixel scale.
    let lo = 1;
    let hi = Math.min(heightFontSize, MAX_SONG_FONT);
    const fits = (fontSize) => songs.every((song, i) =>
        measureRowWidth(song, i, fontSize, liveDebutSongIds, tourDebutSongIds) <= columnWidth
    );
    if (hi <= lo || fits(hi)) {
        return { columns, songFontSize: Math.max(hi, lo) };
    }
    for (let iter = 0; iter < 20; iter++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid; else hi = mid;
    }
    return { columns, songFontSize: lo };
}

// Splits songs into `columns` chunks for rendering, preserving each song's
// original position for numbering. Done manually with plain flexbox rather
// than CSS column-count: html-to-image (the library used to capture the
// final PNG) doesn't reliably replay CSS multi-column layout when it clones
// and serializes the DOM for capture, silently dropping songs that the
// browser's native column-balancing had placed lower down — even though the
// on-screen preview (rendered natively, not through that capture path)
// looks completely fine. Plain flexbox columns render identically in both.
function splitIntoColumns(songs, columns) {
    const indexed = songs.map((song, i) => ({ song, i }));
    if (columns <= 1) return [indexed];
    const perColumn = Math.ceil(indexed.length / columns);
    const result = [];
    for (let c = 0; c < columns; c++) {
        result.push(indexed.slice(c * perColumn, (c + 1) * perColumn));
    }
    return result;
}

// Fixed-pixel-size graphic (1080x1440, the only size offered) captured via
// html-to-image. Layout is identical across styles/tours — only colors change —
// so a new tour style never requires touching this component.
const InstagramPostGraphic = forwardRef(function InstagramPostGraphic({
    show, styleKey, liveDebutSongIds, tourDebutSongIds, backgroundMode = 'style', backgroundImageUrl,
}, ref) {
    const style = getStyleByKey(styleKey);
    const useImageBackground = (backgroundMode === 'poster' || backgroundMode === 'photo') && !!backgroundImageUrl;
    // An image background never trusts the selected color style for text — an
    // arbitrary poster/photo can't be assumed to work with any given palette —
    // so it always uses the fixed high-contrast overlay palette instead,
    // paired with a scrim.
    const palette = useImageBackground ? IMAGE_OVERLAY_PALETTE : style;
    const textShadow = useImageBackground ? IMAGE_TEXT_SHADOW : 'none';

    const songs = SET_KEYS.flatMap(key => show.setlist?.[key] || []);

    const availableHeight = POST_HEIGHT - HEADER_FOOTER_OVERHEAD;
    const columnWidth = (POST_WIDTH - CONTENT_PADDING * 2 - COLUMN_GAP) / 2;
    const { columns, songFontSize } = pickSongLayout(songs, availableHeight, columnWidth, liveDebutSongIds, tourDebutSongIds);
    const venueLine = show.venues
        ? `${show.venues.name} — ${show.venues.city}${show.venues.state_country ? ', ' + show.venues.state_country : ''}`
        : null;

    return (
        <div
            ref={ref}
            style={{
                position: 'relative',
                width: POST_WIDTH,
                height: POST_HEIGHT,
                background: useImageBackground ? '#0b0e13' : style.background,
                fontFamily: FONT_STACK,
                boxSizing: 'border-box',
                overflow: 'hidden',
            }}
        >
            {useImageBackground && (
                <>
                    <img
                        src={backgroundImageUrl}
                        crossOrigin="anonymous"
                        alt=""
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            objectFit: 'cover', objectPosition: 'center',
                        }}
                    />
                    {/* Scrim — darkest at top/bottom where header/footer text sits,
                        never light enough in the middle for the setlist to risk
                        landing on a bright, low-contrast patch of the image. */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(180deg, rgba(3,4,7,0.84) 0%, rgba(3,4,7,0.72) 22%, rgba(3,4,7,0.75) 78%, rgba(3,4,7,0.88) 100%)',
                    }} />
                </>
            )}

            {/* Content layer — sits above the poster image + scrim when present */}
            <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', padding: CONTENT_PADDING, boxSizing: 'border-box',
                color: palette.body, textShadow,
            }}>
                {/* Header */}
                <div style={{ flexShrink: 0 }}>
                    {show.tour_name && (
                        <div style={{
                            fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                            color: palette.accent, marginBottom: 16,
                        }}>
                            {show.tour_name}
                        </div>
                    )}
                    <div style={{
                        fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
                        fontWeight: 700, fontSize: 64, lineHeight: 1.1, color: palette.heading, marginBottom: 20,
                    }}>
                        {show.artist_name}
                    </div>
                    {venueLine && (
                        <div style={{ fontSize: 32, fontWeight: 600, color: palette.body, marginBottom: 6 }}>
                            {venueLine}
                        </div>
                    )}
                    <div style={{ fontSize: 28, color: palette.muted }}>
                        {formatLongDate(show.show_date)}
                    </div>
                    <div style={{ height: 1, background: palette.divider, marginTop: 32 }} />
                </div>

                {/* Setlist — vertically centered in the remaining space */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: COLUMN_GAP }}>
                        {splitIntoColumns(songs, columns).map((columnSongs, colIndex) => (
                            <div key={colIndex} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                {columnSongs.map(({ song, i }) => {
                                    const isLiveDebut = song.song_id != null && liveDebutSongIds?.has(song.song_id);
                                    const isTourDebut = song.song_id != null && tourDebutSongIds?.has(song.song_id);
                                    return (
                                        <div
                                            key={song.id || i}
                                            style={{
                                                fontSize: songFontSize, lineHeight: 1.45, color: palette.heading,
                                                display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: ROW_GAP,
                                            }}
                                        >
                                            <span style={{ flexShrink: 0, color: palette.muted, fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>
                                            <span style={{
                                                minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {song.title}{song.jams_into ? ' →' : ''}
                                            </span>
                                            {isLiveDebut && <DebutTag label="Live Debut" color="#34d399" songFontSize={songFontSize} />}
                                            {isTourDebut && <DebutTag label="Tour Debut" color="#22d3ee" songFontSize={songFontSize} />}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ flexShrink: 0, textAlign: 'center', marginTop: 32 }}>
                    <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: 1, color: palette.heading }}>
                        skysets.org
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 500, color: palette.muted, marginTop: 8 }}>
                        your ultimate archive for all things Johnny Blue Skies & the Dark Clouds
                    </div>
                </div>
            </div>
        </div>
    );
});

export default InstagramPostGraphic;
