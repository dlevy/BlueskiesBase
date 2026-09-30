// Shared avatar-or-initials rendering — used by the header's Edit Profile
// button, the member directory cards, and ProfilePage's identity card, so the
// initials fallback logic lives in exactly one place.
const SIZE_CLASSES = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-20 h-20 text-2xl',
};

// Corner-overlay badge (e.g. the attendance-tier badge from utils/badges.js),
// sized relative to the avatar it sits on.
const BADGE_SIZE_CLASSES = {
    sm: 'w-4 h-4 text-[9px]',
    md: 'w-5 h-5 text-[10px]',
    lg: 'w-6 h-6 text-xs',
};

function initials(name) {
    if (!name) return '?';
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('');
}

// A hover tooltip that's instant and dismissible on tap, unlike the native
// `title` attribute (OS-delayed ~1s, can't be styled, doesn't work well on
// touch). Pure CSS via the `group` hover pattern — no JS/state needed.
function BadgeTooltip({ badge }) {
    return (
        <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium opacity-0 scale-95 transition-all duration-100 ease-out group-hover/badge:opacity-100 group-hover/badge:scale-100"
            style={{ background: '#14171d', color: '#fff', border: '1px solid rgba(245,158,11,0.4)' }}
        >
            {badge.name} <span style={{ color: 'var(--p-color-contrast-low)' }}>· {badge.threshold}+ shows</span>
        </span>
    );
}

export default function Avatar({ url, name, size = 'md', badge = null }) {
    const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

    const content = url ? (
        <img
            src={url}
            alt={name || 'Avatar'}
            className={`${sizeClass} rounded-full object-cover shrink-0 border border-white/10`}
        />
    ) : (
        <div
            className={`${sizeClass} rounded-full shrink-0 flex items-center justify-center font-display font-bold border border-white/10`}
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
        >
            {initials(name)}
        </div>
    );

    if (!badge) return content;

    const badgeSizeClass = BADGE_SIZE_CLASSES[size] || BADGE_SIZE_CLASSES.md;
    return (
        <span className="relative inline-block shrink-0">
            {content}
            <span className="absolute -bottom-0.5 -right-0.5 group/badge">
                <span
                    className={`${badgeSizeClass} flex items-center justify-center rounded-full border-2 cursor-default leading-none`}
                    style={{ background: '#1a1e26', borderColor: '#14171d' }}
                    aria-hidden="true"
                >
                    {badge.emoji}
                </span>
                <BadgeTooltip badge={badge} />
            </span>
        </span>
    );
}
