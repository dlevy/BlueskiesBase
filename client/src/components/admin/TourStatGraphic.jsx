import { forwardRef } from 'react';
import { POST_WIDTH, POST_HEIGHT, getStyleByKey } from '../../utils/instagramStyles';

const SIDE_PADDING = 50;
const BOTTOM_PADDING = 180;
const FONT_STACK = "'Inter', ui-sans-serif, system-ui, sans-serif";
const DISPLAY_FONT_STACK = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";

// Same fixed high-contrast palette InstagramPostGraphic.jsx uses for a
// poster/photo background — a color style can't be trusted to read well
// over an arbitrary image, so image backgrounds always use this instead,
// paired with a dark scrim and a text-shadow on every text layer.
const IMAGE_OVERLAY_PALETTE = {
    heading: '#ffffff',
    body: 'rgba(255,255,255,0.92)',
    muted: 'rgba(255,255,255,0.7)',
    accent: '#fbbf24',
    divider: 'rgba(255,255,255,0.35)',
};
const IMAGE_TEXT_SHADOW = '0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.7)';

function formatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// A short fixed-length step, not a pixel-measurement binary search like
// InstagramPostGraphic's setlist layout needs — a stat headline is always
// one of a handful of known shapes (a number/percent, or a single song/
// album title), so a few length tiers are enough to keep a long title from
// overflowing the fixed frame without the complexity full text-fitting
// would add. Sized big and bold on purpose — a stat card has far less
// content than a setlist card, so the one number/phrase it does show needs
// to carry real visual weight instead of reading as an afterthought.
function numberHeadlineFontSize(text) {
    if (text.length <= 4) return 340;
    if (text.length <= 7) return 250;
    if (text.length <= 10) return 190;
    return 140;
}
function textHeadlineFontSize(text) {
    if (text.length <= 10) return 140;
    if (text.length <= 18) return 112;
    if (text.length <= 28) return 88;
    if (text.length <= 40) return 68;
    return 52;
}

// Specific to the 'denseList' stat type (currently just the "Make America
// Fuk Again" Energy card) — the one stat here that intentionally shows
// every row instead of capping at 6, since it's a single-line-per-show
// novelty list rather than a ranked comparison (see that stat's own
// compute() comment). Columns and font shrink together as the count grows
// so an ongoing tour's ever-lengthening list keeps fitting the fixed frame.
// The 1-column ceiling is deliberately generous (16, not the original 10) —
// each row's "date/city + a couple-word phrase" content comfortably fits
// one line at full card width, but wrapped into 2 narrower columns it wraps
// to 2 lines almost every row instead, which reads as broken, not compact.
function denseListColumns(count) {
    if (count <= 16) return 1;
    if (count <= 34) return 2;
    return 3;
}
function denseListFontSize(count) {
    if (count <= 10) return 30;
    if (count <= 16) return 24;
    if (count <= 24) return 22;
    if (count <= 32) return 19;
    return 16;
}

// Specific to the 'list' stat type — every other list-type stat caps at 6
// rows (MAX_RANKED_ROWS in tourStatTypes.js), so this is a no-op for them;
// Album Breakdown is the one list stat that shows every row with nothing
// left out, so it's the one this actually scales down for once a tour has
// more than 6 meaningfully-sized buckets.
function listRowStyle(count) {
    if (count <= 6) return { number: 38, label: 42, tag: 22, padding: 18 };
    if (count <= 9) return { number: 30, label: 34, tag: 20, padding: 13 };
    if (count <= 12) return { number: 26, label: 29, tag: 18, padding: 10 };
    return { number: 22, label: 25, tag: 16, padding: 7 };
}

// A small solid-fill tag — same contrast approach InstagramPostGraphic's
// DebutTag badge already uses (solid color + near-black text, not a
// color-tinted translucent background), so it reads clearly over any style
// or image backdrop without needing its own light/dark variant.
function Tag({ children, accent, fontSize = 24, style }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            fontSize, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
            color: '#0b0e13', background: accent, borderRadius: 8, padding: '0.35em 0.9em',
            ...style,
        }}>
            {children}
        </span>
    );
}

// Fixed-pixel-size graphic (1080x1350, same as InstagramPostGraphic.jsx),
// captured via html-to-image. A separate component rather than a third
// postType branch on InstagramPostGraphic — a tour stat has no show/setlist
// at all, so the content body is fundamentally different; only the outer
// frame/background/palette pattern is shared, and duplicated here rather
// than forced into a shared base for a handful of lines.
const TourStatGraphic = forwardRef(function TourStatGraphic({
    tourName, artistName, firstDate, lastDate, isOngoing = false, styleKey, backgroundMode = 'style', backgroundImageUrl, tourMapImageUrl, statResult,
}, ref) {
    const style = getStyleByKey(styleKey);
    // Tour Snapshot's map backdrop overrides the normal color/poster/photo
    // choice entirely (TourStatsPostPage disables that picker once this
    // stat is selected) — checked first since it's its own thing, not just
    // another "image background" source.
    const useTourMap = !!tourMapImageUrl;
    const useImageBackground = !useTourMap && (backgroundMode === 'poster' || backgroundMode === 'photo') && !!backgroundImageUrl;
    const palette = (useImageBackground || useTourMap) ? IMAGE_OVERLAY_PALETTE : style;
    const textShadow = (useImageBackground || useTourMap) ? IMAGE_TEXT_SHADOW : 'none';

    const dateRangeLabel = firstDate === lastDate
        ? formatDateShort(firstDate)
        : `${formatDateShort(firstDate)} — ${formatDateShort(lastDate)}`;

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
            {useTourMap ? (
                <>
                    <div
                        role="img"
                        aria-label=""
                        style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: `url("${tourMapImageUrl}")`,
                            backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                        }}
                    />
                    {/* Lighter than the poster/photo scrim, and deliberately
                        clear through the middle — the map is the centerpiece
                        here, not a dimmed backdrop behind it, so it only
                        darkens enough at the very top/bottom for the header
                        and stat strip to stay readable. */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(180deg, rgba(3,4,7,0.8) 0%, rgba(3,4,7,0.2) 24%, rgba(3,4,7,0.18) 60%, rgba(3,4,7,0.9) 100%)',
                    }} />
                </>
            ) : useImageBackground ? (
                <>
                    <div
                        role="img"
                        aria-label=""
                        style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: `url("${backgroundImageUrl}")`,
                            backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                        }}
                    />
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(180deg, rgba(3,4,7,0.84) 0%, rgba(3,4,7,0.72) 22%, rgba(3,4,7,0.75) 78%, rgba(3,4,7,0.88) 100%)',
                    }} />
                </>
            ) : (
                // Subtle dot-grid texture on a flat color style — the plain
                // solid background was the single biggest thing making this
                // card read as unfinished rather than designed. Only for the
                // color-style background; an image backdrop already has its
                // own texture and this would just compete with it.
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `radial-gradient(${palette.accent}22 1.5px, transparent 1.5px)`,
                    backgroundSize: '34px 34px',
                }} />
            )}

            {/* Soft glow behind the hero stat — a radial gradient, not a
                blur filter (CSS filters don't reliably survive the SVG-
                foreignObject rasterization html-to-image uses to export
                this; gradients are plain backgrounds and already proven
                reliable by the scrim above). Gives the number real presence
                instead of sitting flat on the page. Skipped over the tour
                map — it would just muddy the map underneath it for no
                benefit, since there's no single big number here to lift. */}
            {!useTourMap && (
                <div style={{
                    position: 'absolute', left: '50%', top: '58%', transform: 'translate(-50%, -50%)',
                    width: 1100, height: 1100,
                    background: `radial-gradient(circle, ${palette.accent}2e 0%, transparent 60%)`,
                    pointerEvents: 'none',
                }} />
            )}

            <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                paddingLeft: SIDE_PADDING, paddingRight: SIDE_PADDING, paddingTop: SIDE_PADDING, paddingBottom: BOTTOM_PADDING,
                boxSizing: 'border-box',
                color: palette.body, textShadow,
            }}>
                {/* Header — tour name carries the weight here (it's the
                    specific, changing identity of this post), with the band
                    name as a small eyebrow above it rather than the biggest
                    line on the card. A short accent "signature" rule stands
                    in for a full-width divider — a deliberate brand mark
                    rather than a plain hairline. */}
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                    {artistName && (
                        <div style={{
                            fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                            color: palette.muted, marginBottom: 10,
                        }}>
                            {artistName}
                        </div>
                    )}
                    <div style={{
                        fontFamily: DISPLAY_FONT_STACK,
                        fontWeight: 700, fontSize: 56, lineHeight: 1.05, color: palette.heading,
                    }}>
                        {tourName}
                    </div>
                    <div style={{ fontSize: 28, color: palette.muted, marginTop: 18 }}>
                        {dateRangeLabel}
                    </div>
                    {isOngoing && (
                        <div style={{ marginTop: 14 }}>
                            <Tag accent={palette.accent} fontSize={20}>Snapshot — Tour to Date</Tag>
                        </div>
                    )}
                </div>

                {/* Stat body — no bounding box; the pill label + accent
                    underline under the headline carry the framing instead,
                    so the number itself is the thing with visual weight,
                    not a rectangle around it. A fixed marginTop here (on
                    top of whatever `justify-content: space-between` on the
                    parent adds) guarantees a comfortable minimum gap below
                    the header even when the stat content is tall enough
                    that the auto-computed gap alone would run thin. */}
                <div style={{
                    width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 22, marginTop: 36,
                    // Tour map mode: this wrapper expands to fill the
                    // leftover space and anchors its content (the stat
                    // strip) to the bottom of it, so the map shows through
                    // the gap above instead of the strip floating at the
                    // vertical center of the card.
                    ...(useTourMap ? { flex: 1, justifyContent: 'flex-end' } : {}),
                }}>
                    {useTourMap ? (
                        <>
                            <div style={{ display: 'flex', gap: 48, justifyContent: 'center' }}>
                                {[
                                    { label: 'Shows', value: `${statResult.playedShows}/${statResult.totalShows}` },
                                    { label: 'Unique Songs', value: String(statResult.songCount) },
                                    { label: 'Avg/Show', value: statResult.avgSongsPerShow.toFixed(1) },
                                ].map(chip => (
                                    <div key={chip.label}>
                                        <div style={{ fontFamily: DISPLAY_FONT_STACK, fontWeight: 700, fontSize: 68, color: palette.heading }}>
                                            {chip.value}
                                        </div>
                                        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: palette.accent, marginTop: 4 }}>
                                            {chip.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: 26, color: palette.muted }}>
                                {formatDateShort(statResult.firstDate)} → {formatDateShort(statResult.lastDate)}
                            </div>
                        </>
                    ) : statResult.type === 'list' ? (
                        <>
                            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: palette.accent }}>
                                {statResult.title}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 940 }}>
                                {statResult.items.map((item, i) => {
                                    const rowStyle = listRowStyle(statResult.items.length);
                                    return (
                                        <div
                                            key={i}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 20, textAlign: 'left',
                                                padding: `${rowStyle.padding}px 0`,
                                                borderTop: i > 0 ? `1px solid ${palette.divider}` : 'none',
                                            }}
                                        >
                                            <span style={{
                                                flexShrink: 0, width: 56, fontSize: rowStyle.number, fontWeight: 800,
                                                color: palette.accent, fontVariantNumeric: 'tabular-nums',
                                            }}>
                                                {i + 1}
                                            </span>
                                            <span style={{ flex: 1, minWidth: 0, fontSize: rowStyle.label, fontWeight: 700, color: palette.heading, wordBreak: 'break-word' }}>
                                                {item.label}
                                            </span>
                                            <span style={{ flexShrink: 0 }}>
                                                <Tag accent={`${palette.accent}cc`} fontSize={rowStyle.tag} style={{ color: '#0b0e13' }}>{item.value}</Tag>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {statResult.tiedNote && (
                                <div style={{ width: '100%', maxWidth: 940, textAlign: 'left', paddingTop: 14, borderTop: `1px solid ${palette.divider}` }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: palette.muted, wordBreak: 'break-word' }}>
                                        + {statResult.tiedNote.count} more tied
                                        {statResult.tiedNote.names && ` (${statResult.tiedNote.names.join(', ')})`}
                                    </div>
                                </div>
                            )}
                            {statResult.subdetail && (
                                <div style={{ fontSize: 26, color: palette.muted, marginTop: 4 }}>
                                    {statResult.subdetail}
                                </div>
                            )}
                        </>
                    ) : statResult.type === 'denseList' ? (
                        <>
                            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: palette.accent }}>
                                {statResult.title}
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${denseListColumns(statResult.items.length)}, 1fr)`,
                                columnGap: 40, rowGap: 12,
                                width: '100%', maxWidth: 980,
                            }}>
                                {statResult.items.map((item, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left',
                                            fontSize: denseListFontSize(statResult.items.length),
                                        }}
                                    >
                                        <span style={{ flexShrink: 0, color: palette.muted, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                            {item.meta}
                                        </span>
                                        <span style={{ color: palette.heading, fontWeight: 700, wordBreak: 'break-word' }}>
                                            {item.notes}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {statResult.subdetail && (
                                <div style={{ fontSize: 24, color: palette.muted, marginTop: 4 }}>
                                    {statResult.subdetail}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: palette.accent }}>
                                {statResult.label}
                            </div>
                            <div style={{
                                fontFamily: DISPLAY_FONT_STACK,
                                fontWeight: 700, lineHeight: 1.05, color: palette.heading,
                                fontSize: statResult.headlineSize === 'number'
                                    ? numberHeadlineFontSize(statResult.headline)
                                    : textHeadlineFontSize(statResult.headline),
                                wordBreak: 'break-word',
                            }}>
                                {statResult.headline}
                            </div>
                            <div style={{ fontSize: 40, fontWeight: 600, color: palette.body }}>
                                {statResult.detail}
                            </div>
                            {statResult.subdetail && (
                                <div style={{ fontSize: 32, color: palette.muted, whiteSpace: 'pre-line' }}>
                                    {statResult.subdetail}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer — pushed down an extra fixed amount on top of
                    whatever `justify-content: space-between` on the parent
                    already adds, so it sits further toward the bottom of
                    the frame rather than at the auto-computed midpoint. */}
                <div style={{ flexShrink: 0, textAlign: 'center', marginTop: 50 }}>
                    <div style={{ width: 70, height: 3, borderRadius: 2, background: palette.divider, margin: '0 auto 22px' }} />
                    <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: 1, color: palette.heading }}>
                        skysets.org
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 500, color: palette.muted, marginTop: 8 }}>
                        Melt your brain with a fuk-load more stats at skysets.org
                    </div>
                </div>
            </div>
        </div>
    );
});

export default TourStatGraphic;
