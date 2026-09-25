import { forwardRef } from 'react';
import { POST_WIDTH, POST_HEIGHT, getStyleByKey } from '../../utils/instagramStyles';

function formatLongDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });
}

const SET_KEYS = ['set1', 'set2', 'set3', 'encore'];

// Roughly how much vertical space the header + divider + footer take up —
// used to figure out how much room is actually left for the setlist so it
// fills the fixed 1080x1440 post instead of leaving empty bands top/bottom.
// Approximate on purpose: exact isn't the goal.
const HEADER_FOOTER_OVERHEAD = 577;
const MIN_SONG_FONT = 14;
const MAX_SONG_FONT = 34;

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

function pickSongLayout(totalSongs, availableHeight) {
    const usable = Math.max(availableHeight, 100);
    // Try 1 and 2 columns, and keep whichever actually yields the larger
    // (more readable) font — a single threshold check on 1-column font size
    // alone can land just above MIN_SONG_FONT and stick with a cramped
    // single column even when 2 columns would render noticeably bigger.
    let best = null;
    for (let columns = 1; columns <= 2; columns++) {
        const rows = Math.ceil(totalSongs / columns);
        const lineHeight = usable / rows;
        const songFontSize = Math.min(Math.max(lineHeight / 1.45, MIN_SONG_FONT), MAX_SONG_FONT);
        if (!best || songFontSize > best.songFontSize) {
            best = { columns, songFontSize };
        }
    }
    return best;
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
    const totalSongs = songs.length;

    const availableHeight = POST_HEIGHT - HEADER_FOOTER_OVERHEAD;
    const { columns, songFontSize } = pickSongLayout(totalSongs, availableHeight);
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
                fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
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
                display: 'flex', flexDirection: 'column', padding: 64, boxSizing: 'border-box',
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
                    <div style={{ display: 'flex', gap: 56 }}>
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
                                                display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 10,
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
                <div style={{
                    flexShrink: 0, textAlign: 'center', fontSize: 48, fontWeight: 800,
                    letterSpacing: 1, color: palette.heading, marginTop: 32,
                }}>
                    skysets.org
                </div>
            </div>
        </div>
    );
});

export default InstagramPostGraphic;
