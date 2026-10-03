// Generic per-category placeholder icon for a gear item with no photo. Plain
// hand-drawn SVGs (same stroke-based style as the icons in ShowMapShare.jsx)
// rather than a new icon-library dependency.
const ICONS = {
    guitar: (
        <>
            <circle cx="8" cy="16" r="4" />
            <path d="M11 13l7-9" />
            <path d="M15 6l1.5-2M17 8l2-1.5" />
        </>
    ),
    bass: (
        <>
            <circle cx="8" cy="16" r="4.5" />
            <path d="M11 13l8-10" />
            <path d="M16 5l1.5-2M18.5 7.5L21 6" />
        </>
    ),
    amp: (
        <>
            <rect x="4" y="4" width="16" height="16" rx="1.5" />
            <circle cx="9" cy="12" r="2.5" />
            <circle cx="15" cy="12" r="2.5" />
            <path d="M7 7h2M15 7h2" />
        </>
    ),
    pedal: (
        <>
            <rect x="5" y="9" width="14" height="10" rx="1.5" />
            <circle cx="12" cy="14" r="2" />
            <path d="M8 9V6a1 1 0 011-1h6a1 1 0 011 1v3" />
        </>
    ),
    drums: (
        <>
            <ellipse cx="12" cy="8" rx="8" ry="3" />
            <path d="M4 8v6c0 1.66 3.58 3 8 3s8-1.34 8-3V8" />
            <path d="M8.5 19l2-4M15.5 19l-2-4" />
        </>
    ),
    keys: (
        <>
            <rect x="3" y="7" width="18" height="10" rx="1" />
            <path d="M7 7v6M11 7v6M15 7v6M19 7v6" />
        </>
    ),
    vocals_mic: (
        <>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M6 11a6 6 0 0012 0" />
            <path d="M12 17v4M9 21h6" />
        </>
    ),
    other: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 114 2c-.7.6-1.5 1-1.5 2.5" />
            <path d="M12 17.5h.01" />
        </>
    ),
};

export default function GearIcon({ category, size = 24, className = '' }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            {ICONS[category] || ICONS.other}
        </svg>
    );
}
