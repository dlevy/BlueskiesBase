// Shared avatar-or-initials rendering — used by the header's Edit Profile
// button, the member directory cards, and ProfilePage's identity card, so the
// initials fallback logic lives in exactly one place.
const SIZE_CLASSES = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-20 h-20 text-2xl',
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

export default function Avatar({ url, name, size = 'md' }) {
    const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

    if (url) {
        return (
            <img
                src={url}
                alt={name || 'Avatar'}
                className={`${sizeClass} rounded-full object-cover shrink-0 border border-white/10`}
            />
        );
    }

    return (
        <div
            className={`${sizeClass} rounded-full shrink-0 flex items-center justify-center font-display font-bold border border-white/10`}
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
        >
            {initials(name)}
        </div>
    );
}
