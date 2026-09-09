/**
 * Inline preview of the opening songs of a setlist, in the spirit of setlist.fm's
 * search results. Renders nothing when a show has no setlist — most shows in the
 * archive don't have one yet, so this has to disappear cleanly rather than leave
 * an empty row.
 */
export default function SetlistPreview({ titles, total, max = 8, className = '' }) {
    if (!titles?.length) return null;

    const shown = titles.slice(0, max);
    const remaining = (total ?? titles.length) - shown.length;

    return (
        <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-relaxed ${className}`}>
            {shown.map((title, i) => (
                <span key={`${title}-${i}`} className="inline-flex items-baseline gap-2">
                    <span style={{ color: 'var(--p-color-contrast-medium)' }}>{title}</span>
                    {i < shown.length - 1 && (
                        <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.18)' }}>·</span>
                    )}
                </span>
            ))}
            {remaining > 0 && (
                <span className="font-medium" style={{ color: 'var(--p-color-contrast-low)' }}>
                    +{remaining} more
                </span>
            )}
        </div>
    );
}
