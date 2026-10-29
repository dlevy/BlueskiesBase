import { forwardRef } from 'react';
import { assignSetlistDisplayNumbers } from '../../utils/setlist';
import { getStyleByKey, DEFAULT_STYLE_KEY } from '../../utils/instagramStyles';

// Printable at 24x18in (a standard large poster size) once exported at
// pixelRatio 2 (see useGraphicPngExport) — 1800x1350 design px * 2 = 3600x2700,
// which is exactly 24in x 18in at 150dpi. 150dpi is the usual target for a
// large-format print viewed at arm's length or further (not held close like a
// photo), and keeps the export's raw pixel count (and render time) sane for
// what can be 60-70 tiles in one capture.
export const MOSAIC_WIDTH = 1800;
export const MOSAIC_HEIGHT = 1350;
const HEADER_HEIGHT = 90;
const FOOTER_HEIGHT = 46;
// A quarter inch, in design px — 1800 design px = 24in, so 75 design px/in
// (the export's pixelRatio 2 then doubles that to the final 150dpi raster).
// A blank matting buffer on all 4 edges, in the canvas's own background
// color, for anyone printing and framing this with a mat.
const MARGIN = 75 * 0.25;
const CONTENT_WIDTH = MOSAIC_WIDTH - MARGIN * 2;
const CONTENT_HEIGHT = MOSAIC_HEIGHT - MARGIN * 2;
// Thick enough to read as a deliberate stroke between tiles (the grid
// wrapper's own background shows through this gap, and through its matching
// padding around the whole grid's outer edge — see render below), not just
// a hairline.
const GRID_GAP = 6;
// Neutral gray rather than any style's accent color — a bright per-style
// accent (e.g. amber) read as too loud for a stroke that runs between every
// single tile and around the whole poster's edge.
const GRID_STROKE_COLOR = '#52525b';
const FONT_STACK = "'Inter', ui-sans-serif, system-ui, sans-serif";
const DISPLAY_FONT_STACK = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";

// Same scrim recipe InstagramPostGraphic.jsx/TourStatGraphic.jsx use for a
// poster/photo backdrop (IMAGE_TEXT_SHADOW's gradient) — darker than this
// mosaic's original lighter scrim, which left the poster too visible and
// the setlist text low-contrast against it.
const TILE_SCRIM = 'linear-gradient(180deg, rgba(3,4,7,0.84) 0%, rgba(3,4,7,0.72) 22%, rgba(3,4,7,0.75) 78%, rgba(3,4,7,0.88) 100%)';

function formatDateCompact(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function formatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Roughly square-ish cells that still fill the content area's own (~4:3)
// aspect ratio — cols chosen so the grid's own aspect ratio (cols:rows)
// tracks it, not an arbitrary square grid that would leave empty space on
// one axis.
function computeGrid(count) {
    const cols = Math.max(1, Math.round(Math.sqrt(count * (CONTENT_WIDTH / CONTENT_HEIGHT))));
    const rows = Math.max(1, Math.ceil(count / cols));
    return { cols, rows };
}

// One font size for every tile's setlist, not sized per-tile — a tour's
// shorter setlists just end up with extra breathing room (centered, see
// render below) instead of every tile getting its own inconsistent type
// size. Sized off the single longest setlist (in *rendered lines*, see
// tileLineCount below) in the tour so nothing ever overflows its tile, and
// off the actual per-tile pixel size so a tour with fewer, bigger tiles
// gets correspondingly bigger (not just denser) text.
const MIN_SONG_FONT = 6;
const MAX_SONG_FONT = 22;
function pickSongFontSize(maxLineCount, availableHeight) {
    const lineHeight = availableHeight / Math.max(maxLineCount, 1);
    return Math.max(MIN_SONG_FONT, Math.min(MAX_SONG_FONT, lineHeight / 1.35));
}

// A show with an unusually long setlist (this tour's outliers run up to
// ~34 songs vs. a typical ~20) splits its tile into 2 columns — otherwise
// that single outlier would force every tile's font down far enough to
// start clipping its own content against the tile's overflow:hidden edge,
// since the font is shared tour-wide (see pickSongFontSize above). Splitting
// roughly halves the *line count* such an outlier contributes, instead of
// letting it alone dictate a font small enough to break the whole mosaic.
const TWO_COLUMN_SONG_THRESHOLD = 20;
function tileLineCount(songCount) {
    return songCount > TWO_COLUMN_SONG_THRESHOLD ? Math.ceil(songCount / 2) : songCount;
}
// Splits a show's numbered songs into 2 columns for rendering, preserving
// each song's original numbering — same contiguous first-half/second-half
// split (not interleaved) InstagramPostGraphic.jsx's splitIntoColumns uses
// for the same reason: it reads top-to-bottom-then-next-column, matching
// the order songs were actually played.
function splitIntoColumns(numbered) {
    const perColumn = Math.ceil(numbered.length / 2);
    return [numbered.slice(0, perColumn), numbered.slice(perColumn)];
}

// A poster-size collage of every played show on a tour, one tile per show in
// date order, each using that show's own representative poster as its
// backdrop with its setlist overlaid — no per-tile skysets.org footer (that
// branding lives once, for the whole collage, in the strip below the grid
// instead). A fixed-pixel-size graphic captured via html-to-image, same as
// every other graphic in this file's family, just much larger and built from
// many small tiles instead of one full-bleed layout.
const TourMosaicGraphic = forwardRef(function TourMosaicGraphic({
    tourName, artistName, firstDate, lastDate, shows, setlistSongsByShow, posterUrlByShow, styleKey = DEFAULT_STYLE_KEY,
}, ref) {
    const style = getStyleByKey(styleKey);
    const { cols, rows } = computeGrid(shows.length);
    // A show count that doesn't divide evenly into `cols` would otherwise
    // leave the last row's trailing cells empty (dead gray space) — instead,
    // only the full rows use the uniform grid below; whatever's left over
    // renders as its own row of flex:1 tiles that stretch to fill the full
    // width, so every row (including a short last one — reserving a tile
    // for a scheduled-but-not-yet-played show included on purpose, see
    // TourStatsPostPage) spans the complete canvas with no empty gap.
    const fullRows = Math.floor(shows.length / cols);
    const lastRowShows = shows.slice(fullRows * cols);
    const fullRowShows = shows.slice(0, fullRows * cols);
    // CONTENT_WIDTH/HEIGHT (not the full canvas) since the quarter-inch mat
    // buffer around the whole poster eats into available space too, on top
    // of GRID_GAP*2 for the grid wrapper's own outer padding (the same
    // stroke that runs between tiles also frames the grid's own edge).
    const tileWidth = (CONTENT_WIDTH - GRID_GAP * (cols - 1) - GRID_GAP * 2) / cols;
    const tileHeight = (CONTENT_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT - GRID_GAP * (rows - 1) - GRID_GAP * 2) / rows;

    const headerFont = Math.max(9, Math.min(22, tileWidth / 15));
    const dateFont = headerFont * 1.05;
    const cityFont = headerFont * 0.82;
    const tilePadding = Math.max(4, Math.min(14, tileWidth / 28));
    // + tilePadding * 0.6 to account for the header block's own marginBottom
    // below, so the song-area height estimate used for font-fit doesn't run
    // a hair optimistic and risk the last row or two clipping against the
    // tile's overflow:hidden edge.
    const tileHeaderHeight = (dateFont + cityFont) * 1.5 + tilePadding * 0.6;
    const songsAvailableHeight = tileHeight - tileHeaderHeight - tilePadding * 2;

    const maxLineCount = shows.reduce((max, s) => Math.max(max, tileLineCount(setlistSongsByShow[s.id]?.length || 0)), 1);
    const songFontSize = pickSongFontSize(maxLineCount, songsAvailableHeight);

    const dateRangeLabel = firstDate === lastDate
        ? formatDateShort(firstDate)
        : `${formatDateShort(firstDate)} — ${formatDateShort(lastDate)}`;

    // One show's tile — shared by the main grid and the stretched last row
    // below, so a show landing in either place renders identically (only
    // its box's width differs, set by whichever CSS layout places it).
    function renderTile(show) {
        const posterUrl = posterUrlByShow[show.id];
        const songs = setlistSongsByShow[show.id] || [];
        const numbered = assignSetlistDisplayNumbers(songs);
        const columns = songs.length > TWO_COLUMN_SONG_THRESHOLD ? splitIntoColumns(numbered) : [numbered];
        const cityLine = show.venues
            ? `${show.venues.city}${show.venues.state_country ? ', ' + show.venues.state_country : ''}`
            : '';

        return (
            <div
                key={show.id}
                style={{
                    position: 'relative',
                    width: '100%', height: '100%', boxSizing: 'border-box',
                    overflow: 'hidden',
                    background: posterUrl ? '#0b0e13' : style.background,
                }}
            >
                {posterUrl && (
                    <div
                        role="img"
                        aria-label=""
                        style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: `url("${posterUrl}")`,
                            backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                        }}
                    />
                )}
                {/* Scrim — present even over a flat tile background (not
                    just a poster), so every tile's text contrast matches
                    regardless of which backdrop it happens to have. */}
                <div style={{ position: 'absolute', inset: 0, background: TILE_SCRIM }} />

                <div style={{
                    position: 'relative', zIndex: 1, width: '100%', height: '100%',
                    padding: tilePadding, boxSizing: 'border-box',
                    display: 'flex', flexDirection: 'column',
                    color: 'rgba(255,255,255,0.92)',
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                }}>
                    <div style={{ flexShrink: 0, marginBottom: tilePadding * 0.6 }}>
                        <div style={{ fontSize: dateFont, fontWeight: 800, color: '#fbbf24', lineHeight: 1.15 }}>
                            {formatDateCompact(show.show_date)}
                        </div>
                        {cityLine && (
                            <div style={{
                                fontSize: cityFont, fontWeight: 600, color: 'rgba(255,255,255,0.8)', lineHeight: 1.15,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {cityLine}
                            </div>
                        )}
                    </div>

                    {numbered.length === 0 ? (
                        // A scheduled show this tile reserves space for but
                        // that hasn't happened (or hasn't had its setlist
                        // logged) yet — a blank tile here would look like a
                        // rendering bug, so it says why instead.
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: songFontSize * 1.1, fontStyle: 'italic', color: 'rgba(255,255,255,0.55)' }}>
                                Setlist coming soon
                            </span>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', gap: 10, justifyContent: 'center', overflow: 'hidden' }}>
                            {columns.map((columnSongs, colIndex) => (
                                <div key={colIndex} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    {columnSongs.map(({ song, position }, i) => (
                                        <div
                                            // Index, not just song_id — a jam's return
                                            // (sandwiched song) is a second real row with
                                            // the same song_id, so song_id alone collides.
                                            key={`${song.song_id ?? 'x'}-${i}`}
                                            style={{
                                                display: 'flex', flexWrap: 'nowrap', alignItems: 'baseline', gap: 4,
                                                fontSize: songFontSize, lineHeight: 1.35,
                                                opacity: song.performance_type === 'tease' ? 0.65 : 1,
                                                fontStyle: song.performance_type === 'tease' ? 'italic' : 'normal',
                                            }}
                                        >
                                            {position != null && (
                                                <span style={{ flexShrink: 0, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>
                                                    {position}.
                                                </span>
                                            )}
                                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                {song.title}{song.jams_into ? ' →' : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={ref}
            style={{
                width: MOSAIC_WIDTH,
                height: MOSAIC_HEIGHT,
                // The quarter-inch mat buffer itself — this background fills
                // it, since everything else below is inset from it by
                // `padding: MARGIN`.
                background: style.background,
                fontFamily: FONT_STACK,
                boxSizing: 'border-box',
                padding: MARGIN,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header — the one place the tour's own identity/branding shows,
                since it's been stripped out of every tile below. Plain block
                layout + textAlign:center, not a flex column — a flex column
                with alignItems:center shrink-wraps each child to fit-content,
                and that was leaving the title's box narrower than its own
                one-line text width, wrapping a short title like "Mutiny for
                the Masses" onto 2 lines (overlapping the date line below it)
                despite the full 1800px canvas having plenty of room. */}
            <div style={{
                flexShrink: 0, width: '100%', height: HEADER_HEIGHT, boxSizing: 'border-box',
                display: 'flex', flexDirection: 'column',
                justifyContent: 'center', textAlign: 'center',
            }}>
                {artistName && (
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: style.muted }}>
                        {artistName}
                    </div>
                )}
                <div style={{ fontFamily: DISPLAY_FONT_STACK, fontWeight: 700, fontSize: 30, lineHeight: 1.1, color: style.heading }}>
                    {tourName}
                </div>
                <div style={{ fontSize: 14, color: style.muted, marginTop: 2 }}>
                    {dateRangeLabel} &middot; {shows.length} shows
                </div>
            </div>

            {/* Grid — the wrapper's own gray background shows through both
                the gaps between tiles (here and in the stretched last row
                below) and, via this wrapper's own padding, as a matching
                border around the whole grid's outer edge — a tile otherwise
                fills its cell edge-to-edge. Split into fullRows-worth of
                uniform cells plus (when the show count doesn't divide evenly
                by `cols`) one final row of flex:1 tiles stretched to fill
                the complete width, rather than a single grid that would
                leave that row's trailing cells empty — see
                fullRows/lastRowShows above. */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', gap: GRID_GAP,
                padding: GRID_GAP, boxSizing: 'border-box',
                background: GRID_STROKE_COLOR, overflow: 'hidden',
            }}>
                {fullRows > 0 && (
                    <div style={{
                        flex: `${fullRows} 1 0%`,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        gridTemplateRows: `repeat(${fullRows}, 1fr)`,
                        gap: GRID_GAP,
                        background: GRID_STROKE_COLOR,
                    }}>
                        {fullRowShows.map(show => renderTile(show))}
                    </div>
                )}
                {lastRowShows.length > 0 && (
                    <div style={{ flex: '1 1 0%', display: 'flex', gap: GRID_GAP, background: GRID_STROKE_COLOR }}>
                        {lastRowShows.map(show => (
                            <div key={show.id} style={{ flex: 1, minWidth: 0 }}>
                                {renderTile(show)}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer — a single credit line for the whole collage, since it's
                been removed from every individual tile. */}
            <div style={{
                flexShrink: 0, height: FOOTER_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, letterSpacing: 1, color: style.accent,
            }}>
                skysets.org
            </div>
        </div>
    );
});

export default TourMosaicGraphic;
