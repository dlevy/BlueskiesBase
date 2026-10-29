import { forwardRef } from 'react';
import { POST_WIDTH, POST_HEIGHT, getStyleByKey } from '../../utils/instagramStyles';
import { assignSetlistDisplayNumbers } from '../../utils/setlist';

function formatLongDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });
}

// Calendar-year difference, not a 365-day diff — matches how "on this day"
// features elsewhere (and fans themselves) talk about anniversaries.
function yearsAgo(dateString) {
    return new Date().getFullYear() - Number(dateString.slice(0, 4));
}

const SET_KEYS = ['set1', 'set2', 'set3', 'encore'];

// Instagram's recommended safe zone for a 3:4 feed post — content is kept
// clear of these margins so it isn't cropped in grid view or covered by the
// app's own UI chrome. The bottom gets much more room than the sides since
// that's where feed UI overlaps the image most.
const SIDE_PADDING = 50;
const BOTTOM_PADDING = 180;

// Roughly how much vertical space the header + divider + footer (including
// the tagline beneath the footer link) take up as rendered content — NOT
// including the safe-zone padding above/below, which is accounted for
// separately. Used to figure out how much room is actually left for the
// setlist so it fills the fixed 1080x1350 post instead of leaving empty
// bands top/bottom. Approximate on purpose: exact isn't the goal, but it
// needs to stay in the right ballpark, since the font size below is computed
// from this estimate, not measured from the real rendered header/footer.
const HEADER_FOOTER_CONTENT = 485;
const MAX_SONG_FONT = 34;

// Extra vertical space the "On This Day" badge row adds above the normal
// header content — folded into the HEADER_FOOTER_CONTENT estimate when that
// post type is active, so the setlist's font-size math still accounts for
// the real amount of space left, instead of overflowing/clipping by however
// tall this row ends up being.
const TIME_MACHINE_BADGE_HEIGHT = 76;

// Must match the actual rendered layout below (gap between the two columns,
// gap within a song row) — the width-fitting math needs the real pixel
// values, not estimates, since a fixed gap doesn't scale with font size the
// way text does.
const COLUMN_GAP = 56;
const ROW_GAP = 10;
// Small breathing room above a wrapped tags line (see pickSongLayout/render
// below) — folded into the height budget so accounting for it doesn't risk
// overflowing a setlist with several wrapped rows.
const TAG_WRAP_GAP = 4;
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

function SongTag({ label, color, songFontSize }) {
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

// Every tag a song can carry on the public show page's own setlist (see
// ShowDetailPage.jsx's SongRow) — live/tour debut, rare, tease/partial/DJ'd
// performance type, cover, and Sunday Valley — all surfaced here too, not
// just the two debut tags, so the post reflects the same "what's notable
// about this show" signal the site itself shows. `tourRarity` is the same
// { total_shows, song_counts } shape GET /shows/:id/tour-rarity returns,
// optional (a show with no tour_name never fetches it) — Rare is simply
// skipped when it's not available.
function getSongTags(song, { liveDebutSongIds, tourDebutSongIds, tourRarity }) {
    const tags = [];
    // A tease doesn't count as the song actually being played — Live Debut,
    // Tour Debut and Rare are all claims about a real performance, and a
    // tease shouldn't earn any of them just by teasing a song for the first
    // time (ever or this tour) or infrequently.
    const isTease = song.performance_type === 'tease';
    const isLiveDebut = !isTease && song.song_id != null && liveDebutSongIds?.has(song.song_id);
    const isTourDebut = !isTease && song.song_id != null && tourDebutSongIds?.has(song.song_id);
    if (isLiveDebut) tags.push({ label: 'Live Debut', color: '#34d399' });
    if (isTourDebut) tags.push({ label: 'Tour Debut', color: '#22d3ee' });
    if (!isTease && tourRarity?.total_shows > 0 && song.song_id != null) {
        const tourCount = tourRarity.song_counts?.[song.song_id];
        if (tourCount != null && tourCount / tourRarity.total_shows < 0.15) {
            tags.push({ label: 'Rare', color: '#c084fc' });
        }
    }
    if (song.performance_type === 'tease') tags.push({ label: 'Tease', color: '#fbbf24' });
    if (song.performance_type === 'partial') tags.push({ label: 'Partial', color: '#fb923c' });
    if (song.performance_type === 'dj') tags.push({ label: "DJ'd", color: '#94a3b8' });
    if (song.is_original === false) tags.push({ label: 'Cover', color: '#60a5fa' });
    if (song.is_sunday_valley) tags.push({ label: 'Sunday Valley', color: '#2dd4bf' });
    return tags;
}

// The widest a single song's row (number + title + any tags) can be at a
// given font size — a song's row never wraps (see the render below), so if
// this exceeds the column width the title gets ellipsis-truncated. Tag font
// size and padding are both proportional to songFontSize (see SongTag), so
// their width scales with it too; only the flex gaps between elements are
// fixed pixel values that don't scale with font size.
// The number column is a fixed width shared by every row (see
// numberColumnTemplate below) — a row with no number at all (a jam's
// return, or a tease; see assignSetlistDisplayNumbers) still reserves that
// same width, left blank, so every title still starts at the same x
// position instead of a numberless row's title creeping left into the gap.
function measureRowWidth(song, fontSize, tagContext, numberColumnWidth) {
    const titleText = `${song.title}${song.jams_into ? ' →' : ''}`;
    const titleWidth = measureTextWidth(titleText, fontSize, 400);
    let width = numberColumnWidth + ROW_GAP + titleWidth;

    const tagFontSize = Math.max(10, Math.round(fontSize * 0.4));
    getSongTags(song, tagContext).forEach(({ label }) => {
        // SongTag's own padding is '0.15em 0.5em' — 0.5em each side, 1em top/bottom half.
        const tagPadding = tagFontSize; // 0.5em * 2 sides = 1em = tagFontSize px
        width += ROW_GAP + measureTextWidth(label, tagFontSize, 700) + tagPadding;
    });
    return width;
}

// Always two columns. The font has no minimum floor — it shrinks as far as
// necessary so every song fits vertically, within the available height. No
// floor here is exactly what used to cause songs to get silently clipped
// off the top/bottom of long setlists.
//
// A song whose title + tags are too wide for the column no longer shrinks
// the font for every other song to make room — its tags wrap onto their own
// line below the title instead (see the render below), so this only needs
// to size for *height*, treating a wrapped song as 2 line-units instead of
// 1 wherever that happens to land, rather than also sizing for every row's
// full tagged width like it used to.
function pickSongLayout(numberedSongs, availableHeight, columnWidth, tagContext, numberColumnTemplate) {
    const usable = Math.max(availableHeight, 100);
    const columns = 2;
    const rows = Math.max(1, Math.ceil(numberedSongs.length / columns));
    const colSongs = splitIntoColumns(numberedSongs, columns);

    // Optimistic upper bound assuming every row stays on one line — real
    // required height can only be >= this once any wrapping is accounted
    // for in `fits` below, so it's a safe starting point for the search.
    const lineHeight = usable / rows;
    const heightFontSize = lineHeight / 1.45;

    // Binary-search the largest font size at which every column's songs —
    // 2 line-units for one whose tags don't fit inline at that size, 1
    // otherwise — still fit within the available height. Tag width doesn't
    // scale perfectly linearly with font size (Math.max(10, Math.round(...))
    // floors/rounds it), so a closed-form solve isn't reliable; a quick
    // search is simpler and exact enough at pixel scale.
    const fits = (fontSize) => {
        const numberColumnWidth = measureTextWidth(numberColumnTemplate, fontSize, 400);
        const perLineHeight = fontSize * 1.45;
        return colSongs.every(column => {
            const lineUnits = column.reduce((sum, { song }) =>
                sum + (measureRowWidth(song, fontSize, tagContext, numberColumnWidth) <= columnWidth ? 1 : 2), 0);
            const wrappedCount = lineUnits - column.length;
            return lineUnits * perLineHeight + wrappedCount * TAG_WRAP_GAP <= usable;
        });
    };
    let lo = 1;
    let hi = Math.min(heightFontSize, MAX_SONG_FONT);
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
function splitIntoColumns(numberedSongs, columns) {
    if (columns <= 1) return [numberedSongs];
    const perColumn = Math.ceil(numberedSongs.length / columns);
    const result = [];
    for (let c = 0; c < columns; c++) {
        result.push(numberedSongs.slice(c * perColumn, (c + 1) * perColumn));
    }
    return result;
}

// Fixed-pixel-size graphic (1080x1350, the only size offered) captured via
// html-to-image. Layout is identical across styles/tours — only colors change —
// so a new tour style never requires touching this component.
const InstagramPostGraphic = forwardRef(function InstagramPostGraphic({
    show, styleKey, liveDebutSongIds, tourDebutSongIds, tourRarity, backgroundMode = 'style', backgroundImageUrl, postType = 'setlist',
}, ref) {
    const tagContext = { liveDebutSongIds, tourDebutSongIds, tourRarity };
    const style = getStyleByKey(styleKey);
    const useImageBackground = (backgroundMode === 'poster' || backgroundMode === 'photo') && !!backgroundImageUrl;
    // An image background never trusts the selected color style for text — an
    // arbitrary poster/photo can't be assumed to work with any given palette —
    // so it always uses the fixed high-contrast overlay palette instead,
    // paired with a scrim.
    const palette = useImageBackground ? IMAGE_OVERLAY_PALETTE : style;
    const textShadow = useImageBackground ? IMAGE_TEXT_SHADOW : 'none';

    // InstagramPostPage fetches the selected poster/photo itself and hands
    // this component a data: URL, not the remote Supabase URL — removing any
    // cross-origin/canvas-taint question for the live preview or the
    // html-to-image export. Separately, the background is a CSS
    // background-image div here, not an <img>: WebKit's SVG-foreignObject
    // rasterization (what html-to-image uses to produce the export) has a
    // long-standing history of dropping <img> "replaced" elements while
    // still painting plain CSS backgrounds correctly — switching this from
    // object-fit:cover on an <img> to background-size:cover on a div is a
    // known, much more reliable path through that same rasterization step.
    const songs = SET_KEYS.flatMap(key => show.setlist?.[key] || []);
    const numberedSongs = assignSetlistDisplayNumbers(songs);
    // Widest numeral the number column needs to fit, at this show's actual
    // highest position — not a per-row width, so every row (numbered or
    // not) reserves the exact same column width and every title starts at
    // the same x position, same as the public show page's fixed w-6 slot.
    const maxPosition = numberedSongs.reduce((max, { position }) => Math.max(max, position || 0), 0);
    const numberColumnTemplate = `${'9'.repeat(String(maxPosition).length || 1)}.`;

    const isOnThisDay = postType === 'onThisDay';
    const onThisDayYears = isOnThisDay ? yearsAgo(show.show_date) : null;
    const availableHeight = POST_HEIGHT - SIDE_PADDING - BOTTOM_PADDING - HEADER_FOOTER_CONTENT - (isOnThisDay ? TIME_MACHINE_BADGE_HEIGHT : 0);
    const columnWidth = (POST_WIDTH - SIDE_PADDING * 2 - COLUMN_GAP) / 2;
    const { columns, songFontSize } = pickSongLayout(numberedSongs, availableHeight, columnWidth, tagContext, numberColumnTemplate);
    const numberColumnWidth = measureTextWidth(numberColumnTemplate, songFontSize, 400);
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
                    <div
                        role="img"
                        aria-label=""
                        style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: `url("${backgroundImageUrl}")`,
                            backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
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
                display: 'flex', flexDirection: 'column',
                paddingLeft: SIDE_PADDING, paddingRight: SIDE_PADDING, paddingTop: SIDE_PADDING, paddingBottom: BOTTOM_PADDING,
                boxSizing: 'border-box',
                color: palette.body, textShadow,
            }}>
                {/* Header */}
                <div style={{ flexShrink: 0 }}>
                    {isOnThisDay && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 10,
                            padding: '9px 20px', marginBottom: 24,
                            border: `2px dashed ${palette.accent}`, borderRadius: 999,
                            color: palette.accent,
                        }}>
                            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth="2">
                                <path d="M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                                On This Day
                            </span>
                            {onThisDayYears > 0 && (
                                <span style={{ fontSize: 24, fontWeight: 800 }}>
                                    &middot; {onThisDayYears} {onThisDayYears === 1 ? 'Year' : 'Years'} Ago
                                </span>
                            )}
                        </div>
                    )}
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
                        {splitIntoColumns(numberedSongs, columns).map((columnSongs, colIndex) => (
                            <div key={colIndex} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                {columnSongs.map(({ song, position }, i) => {
                                    const tags = getSongTags(song, tagContext);
                                    // Only this song's tags drop to their own line below the
                                    // title — not every song's font shrinking to make this one's
                                    // tags fit inline (see pickSongLayout above, which already
                                    // sized for whichever songs land here).
                                    const tagsFitInline = measureRowWidth(song, songFontSize, tagContext, numberColumnWidth) <= columnWidth;
                                    return (
                                        <div
                                            key={song.id || i}
                                            style={{ fontSize: songFontSize, lineHeight: 1.45, color: palette.heading }}
                                        >
                                            <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: ROW_GAP }}>
                                                <span style={{
                                                    flexShrink: 0, width: numberColumnWidth, textAlign: 'right',
                                                    color: palette.muted, fontVariantNumeric: 'tabular-nums',
                                                }}>
                                                    {position != null ? `${position}.` : ''}
                                                </span>
                                                <span style={{
                                                    minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {song.title}{song.jams_into ? ' →' : ''}
                                                </span>
                                                {tagsFitInline && tags.map(tag => (
                                                    <SongTag key={tag.label} label={tag.label} color={tag.color} songFontSize={songFontSize} />
                                                ))}
                                            </div>
                                            {!tagsFitInline && tags.length > 0 && (
                                                <div style={{
                                                    display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: ROW_GAP,
                                                    marginTop: TAG_WRAP_GAP, paddingLeft: numberColumnWidth + ROW_GAP,
                                                }}>
                                                    {tags.map(tag => (
                                                        <SongTag key={tag.label} label={tag.label} color={tag.color} songFontSize={songFontSize} />
                                                    ))}
                                                </div>
                                            )}
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
