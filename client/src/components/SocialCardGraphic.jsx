import { forwardRef } from 'react';
import { POST_WIDTH, POST_HEIGHT } from '../utils/instagramStyles';

const SIDE_PADDING = 48;
const FONT_STACK = "'Inter', ui-sans-serif, system-ui, sans-serif";
const DISPLAY_FONT_STACK = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";

// Same fixed high-contrast palette the other graphic generators use over an
// image backdrop — a color style can't be trusted to read well over an
// arbitrary photo/map, so this card (whose background is always the
// member's own show map) always uses it, paired with a scrim + text-shadow.
const PALETTE = {
    heading: '#ffffff',
    body: 'rgba(255,255,255,0.92)',
    muted: 'rgba(255,255,255,0.7)',
    accent: '#fbbf24',
    divider: 'rgba(255,255,255,0.35)',
};
const TEXT_SHADOW = '0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.7)';

function initials(name) {
    if (!name) return '?';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// Small solid-fill tag — same contrast approach the Instagram/tour-stat
// graphics use (solid color + near-black text), so it reads clearly over
// the map backdrop at any point on the card.
function Tag({ children, fontSize = 22 }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            fontSize, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
            color: '#0b0e13', background: `${PALETTE.accent}cc`, borderRadius: 8, padding: '0.3em 0.75em',
        }}>
            {children}
        </span>
    );
}

// `sub` spells out what the badge means (e.g. "10+ shows") — this card is a
// static exported image, so it can't rely on Avatar.jsx's hover tooltip to
// explain a badge; the explanation has to be baked into the chip itself.
function BadgeChip({ emoji, label, sub }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(0,0,0,0.38)', border: `1px solid ${PALETTE.divider}`,
            borderRadius: 16, padding: '12px 22px',
        }}>
            <span style={{ fontSize: 32, lineHeight: 1 }}>{emoji}</span>
            <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: PALETTE.heading, lineHeight: 1.15 }}>{label}</div>
                {sub && <div style={{ fontSize: 17, color: PALETTE.muted, marginTop: 2 }}>{sub}</div>}
            </div>
        </div>
    );
}

function StatTile({ value, label }) {
    return (
        <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: DISPLAY_FONT_STACK, fontWeight: 700, fontSize: 50, color: PALETTE.heading, lineHeight: 1 }}>
                {value}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: PALETTE.accent, marginTop: 6 }}>
                {label}
            </div>
        </div>
    );
}

// A member's own personalized stat card — their show map as the backdrop,
// their avatar/username, fun attendance/song numbers, earned badges, and
// their 5 rarest songs seen live. Fixed 1080x1350 frame (same as the
// Instagram setlist/tour-stat generators), captured the same way via
// html-to-image. A separate component rather than a mode bolted onto
// TourStatGraphic — this card's content (identity + badges + a ranked list)
// doesn't match either of that component's two layouts.
const SocialCardGraphic = forwardRef(function SocialCardGraphic({
    mapImageUrl,
    avatarDataUrl,
    displayName,
    username,
    memberSinceYear,
    showsAttended,
    upcomingShows,
    songsSeenLive,
    liveDebutsWitnessed,
    citiesVisited,
    highestBadge,
    highestCommunityTier,
    rarestSongsSeen = [],
    rarestSongsSeenTiedNote,
}, ref) {
    return (
        <div
            ref={ref}
            style={{
                position: 'relative',
                width: POST_WIDTH,
                height: POST_HEIGHT,
                background: '#0b0e13',
                fontFamily: FONT_STACK,
                boxSizing: 'border-box',
                overflow: 'hidden',
            }}
        >
            {/* Backdrop — the member's own show map, full-bleed */}
            {mapImageUrl && (
                <div
                    role="img"
                    aria-label=""
                    style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url("${mapImageUrl}")`,
                        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                    }}
                />
            )}
            {/* Lighter scrim, dark mainly at the very top/bottom (identity
                header, footer) and clearing through the middle — legibility
                over the body content comes from each block's own panel
                background below, not from darkening the whole map. */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(3,4,7,0.7) 0%, rgba(3,4,7,0.3) 18%, rgba(3,4,7,0.12) 40%, rgba(3,4,7,0.18) 68%, rgba(3,4,7,0.8) 100%)',
            }} />

            <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                paddingLeft: SIDE_PADDING, paddingRight: SIDE_PADDING, paddingTop: SIDE_PADDING, paddingBottom: SIDE_PADDING,
                boxSizing: 'border-box',
                color: PALETTE.body, textShadow: TEXT_SHADOW,
            }}>
                {/* Identity header */}
                <div style={{ flexShrink: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                        fontSize: 20, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: PALETTE.accent,
                    }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, backgroundImage: 'url("/logo.png")', backgroundSize: 'cover' }} />
                        SkySets.org
                    </div>

                    <div style={{ position: 'relative', width: 150, height: 150 }}>
                        {avatarDataUrl ? (
                            <div style={{
                                width: 150, height: 150, borderRadius: '50%',
                                backgroundImage: `url("${avatarDataUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center',
                                boxShadow: `0 0 0 4px ${PALETTE.accent}, 0 0 40px rgba(251,191,36,0.4)`,
                            }} />
                        ) : (
                            <div style={{
                                width: 150, height: 150, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: DISPLAY_FONT_STACK, fontWeight: 700, fontSize: 54, color: PALETTE.heading,
                                background: 'rgba(251,191,36,0.22)',
                                boxShadow: `0 0 0 4px ${PALETTE.accent}, 0 0 40px rgba(251,191,36,0.4)`,
                            }}>
                                {initials(displayName || username)}
                            </div>
                        )}
                        {highestBadge && (
                            <div style={{
                                position: 'absolute', bottom: -4, right: -4,
                                width: 46, height: 46, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 24, background: '#1a1e26', boxShadow: `0 0 0 3px ${PALETTE.accent}`,
                            }}>
                                {highestBadge.emoji}
                            </div>
                        )}
                    </div>

                    <div style={{ fontFamily: DISPLAY_FONT_STACK, fontWeight: 700, fontSize: 48, color: PALETTE.heading, marginTop: 16 }}>
                        {displayName || username}
                    </div>
                    {memberSinceYear && (
                        <div style={{ fontSize: 20, color: PALETTE.muted, marginTop: 6 }}>
                            SkySets member since {memberSinceYear}
                        </div>
                    )}
                </div>

                {/* Body — stat tiles, earned badges, rarest songs. Each block
                    carries its own panel background rather than relying on a
                    full-frame scrim, so the map stays visible in the gaps
                    between them instead of being darkened everywhere. */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        background: 'rgba(0,0,0,0.42)', borderRadius: 20, padding: '16px 14px',
                    }}>
                        <StatTile value={showsAttended} label="Shows Seen" />
                        <StatTile value={songsSeenLive} label="Songs Seen" />
                        <StatTile value={liveDebutsWitnessed} label="Debuts" />
                        <StatTile value={citiesVisited} label="Cities" />
                        <StatTile value={upcomingShows} label="Upcoming" />
                    </div>

                    {(highestBadge || highestCommunityTier) && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                            {highestBadge && <BadgeChip emoji={highestBadge.emoji} label={highestBadge.name} sub={`${highestBadge.threshold}+ shows`} />}
                            {highestCommunityTier && <BadgeChip emoji={highestCommunityTier.emoji} label={highestCommunityTier.name} sub={`${highestCommunityTier.threshold}+ contributions`} />}
                        </div>
                    )}

                    {rarestSongsSeen.length > 0 && (
                        <div style={{
                            display: 'flex', flexDirection: 'column',
                            background: 'rgba(0,0,0,0.42)', borderRadius: 20, padding: '16px 24px',
                        }}>
                            <div style={{
                                fontSize: 24, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
                                color: PALETTE.accent, textAlign: 'center', marginBottom: 10,
                            }}>
                                Rarest Songs I've Seen Live
                            </div>
                            {rarestSongsSeen.map((song, i) => (
                                <div
                                    key={song.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 16,
                                        padding: '8px 0',
                                        borderTop: i > 0 ? `1px solid ${PALETTE.divider}` : 'none',
                                    }}
                                >
                                    <span style={{ flexShrink: 0, width: 32, fontSize: 24, fontWeight: 800, color: PALETTE.accent, fontVariantNumeric: 'tabular-nums' }}>
                                        {i + 1}
                                    </span>
                                    <span style={{ flex: 1, minWidth: 0, fontSize: 27, fontWeight: 700, color: PALETTE.heading, wordBreak: 'break-word' }}>
                                        {song.title}
                                    </span>
                                    <span style={{ flexShrink: 0 }}>
                                        <Tag fontSize={19}>{song.globalPlayCount}x all-time</Tag>
                                    </span>
                                </div>
                            ))}
                            {rarestSongsSeenTiedNote && (
                                <div style={{ fontSize: 16, color: PALETTE.muted, marginTop: 6, wordBreak: 'break-word' }}>
                                    + {rarestSongsSeenTiedNote.count} more tied
                                    {rarestSongsSeenTiedNote.names && ` (${rarestSongsSeenTiedNote.names.join(', ')})`}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                    <div style={{ width: 70, height: 3, borderRadius: 2, background: PALETTE.divider, margin: '0 auto 16px' }} />
                    <div style={{ fontFamily: DISPLAY_FONT_STACK, fontSize: 40, fontWeight: 800, letterSpacing: 1, color: PALETTE.heading }}>
                        skysets.org
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 500, color: PALETTE.muted, marginTop: 6, lineHeight: 1.25 }}>
                        Build your own stats card to share at the only JBS specific setlist archive, skysets.org
                    </div>
                </div>
            </div>
        </div>
    );
});

export default SocialCardGraphic;
