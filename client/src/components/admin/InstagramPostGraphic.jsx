import { forwardRef } from 'react';
import { getFormatByKey, getStyleByKey } from '../../utils/instagramStyles';

function formatLongDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });
}

const SETS = [
    { key: 'set1', label: 'Set 1' },
    { key: 'set2', label: 'Set 2' },
    { key: 'set3', label: 'Set 3' },
    { key: 'encore', label: 'Encore' },
];

// Fixed-pixel-size graphic (1080-wide, height depends on format) captured via
// html-to-image. Layout is identical across styles/tours — only colors change —
// so a new tour style never requires touching this component.
const InstagramPostGraphic = forwardRef(function InstagramPostGraphic({ show, formatKey, styleKey }, ref) {
    const format = getFormatByKey(formatKey);
    const style = getStyleByKey(styleKey);

    const sets = SETS
        .map(s => ({ ...s, songs: show.setlist?.[s.key] || [] }))
        .filter(s => s.songs.length > 0);
    const totalSongs = sets.reduce((sum, s) => sum + s.songs.length, 0);

    const columns = totalSongs > 14 ? 2 : 1;
    const songFontSize = totalSongs <= 12 ? 30 : totalSongs <= 20 ? 24 : totalSongs <= 30 ? 20 : 16;
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
                <div style={{ columnCount: columns, columnGap: 56, columnFill: 'balance' }}>
                    {sets.map(set => (
                        <div key={set.key} style={{ marginBottom: 28 }}>
                            <div style={{
                                fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
                                color: style.accent, marginBottom: 12,
                            }}>
                                {set.label}
                            </div>
                            {set.songs.map((song, i) => (
                                <div
                                    key={song.id || i}
                                    style={{
                                        fontSize: songFontSize, lineHeight: 1.45, color: style.heading,
                                        breakInside: 'avoid', display: 'flex', gap: 10,
                                    }}
                                >
                                    <span style={{ color: style.muted, fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>
                                    <span>{song.title}{song.jams_into ? ' →' : ''}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div style={{
                flexShrink: 0, textAlign: 'center', fontSize: 26, fontWeight: 700,
                letterSpacing: 1, color: style.accent, marginTop: 32,
            }}>
                skysets.org
            </div>
        </div>
    );
});

export default InstagramPostGraphic;
