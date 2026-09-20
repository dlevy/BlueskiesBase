import { forwardRef } from 'react';
import { getFormatByKey, getStyleByKey } from '../../utils/instagramStyles';

function formatLongDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });
}

const SET_KEYS = ['set1', 'set2', 'set3', 'encore'];

// Roughly how much vertical space the header + divider + footer take up,
// regardless of format — used to figure out how much room is actually left
// for the setlist so it can be sized to fill each format instead of just
// square. Approximate on purpose: exact isn't the goal, avoiding big empty
// bands top/bottom on the taller formats is.
const HEADER_FOOTER_OVERHEAD = 577;
const MIN_SONG_FONT = 14;
const MAX_SONG_FONT = 34;

function DebutTag({ label, color, songFontSize }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', flexShrink: 0,
            fontSize: Math.max(10, Math.round(songFontSize * 0.4)),
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            color, background: `${color}22`, borderRadius: 4, padding: '0.15em 0.5em',
        }}>
            {label}
        </span>
    );
}

function pickSongLayout(totalSongs, availableHeight) {
    const usable = Math.max(availableHeight, 100);
    let columns = 1;
    let lineHeight = usable / totalSongs;
    if (lineHeight / 1.45 < MIN_SONG_FONT && totalSongs > 6) {
        columns = 2;
        lineHeight = usable / Math.ceil(totalSongs / 2);
    }
    const songFontSize = Math.min(Math.max(lineHeight / 1.45, MIN_SONG_FONT), MAX_SONG_FONT);
    return { columns, songFontSize };
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

// Fixed-pixel-size graphic (1080-wide, height depends on format) captured via
// html-to-image. Layout is identical across styles/tours — only colors change —
// so a new tour style never requires touching this component.
const InstagramPostGraphic = forwardRef(function InstagramPostGraphic({ show, formatKey, styleKey, liveDebutSongIds, tourDebutSongIds }, ref) {
    const format = getFormatByKey(formatKey);
    const style = getStyleByKey(styleKey);

    const songs = SET_KEYS.flatMap(key => show.setlist?.[key] || []);
    const totalSongs = songs.length;

    const availableHeight = format.height - HEADER_FOOTER_OVERHEAD;
    const { columns, songFontSize } = pickSongLayout(totalSongs, availableHeight);
    const venueLine = show.venues
        ? `${show.venues.name} — ${show.venues.city}${show.venues.state_country ? ', ' + show.venues.state_country : ''}`
        : null;

    return (
        <div
            ref={ref}
            style={{
                width: format.width,
                height: format.height,
                background: style.background,
                color: style.body,
                fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
                display: 'flex',
                flexDirection: 'column',
                padding: 64,
                boxSizing: 'border-box',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div style={{ flexShrink: 0 }}>
                {show.tour_name && (
                    <div style={{
                        fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                        color: style.accent, marginBottom: 16,
                    }}>
                        {show.tour_name}
                    </div>
                )}
                <div style={{
                    fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
                    fontWeight: 700, fontSize: 64, lineHeight: 1.1, color: style.heading, marginBottom: 20,
                }}>
                    {show.artist_name}
                </div>
                {venueLine && (
                    <div style={{ fontSize: 32, fontWeight: 600, color: style.body, marginBottom: 6 }}>
                        {venueLine}
                    </div>
                )}
                <div style={{ fontSize: 28, color: style.muted }}>
                    {formatLongDate(show.show_date)}
                </div>
                <div style={{ height: 1, background: style.divider, marginTop: 32 }} />
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
                                            fontSize: songFontSize, lineHeight: 1.45, color: style.heading,
                                            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
                                        }}
                                    >
                                        <span style={{ color: style.muted, fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>
                                        <span>{song.title}{song.jams_into ? ' →' : ''}</span>
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
                letterSpacing: 1, color: style.heading, marginTop: 32,
            }}>
                skysets.org
            </div>
        </div>
    );
});

export default InstagramPostGraphic;
