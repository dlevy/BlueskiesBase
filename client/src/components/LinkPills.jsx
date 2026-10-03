// Read-only display for an arbitrary {text, url} link list (see LinksEditor.jsx)
// — used on the public band pages for both member-level and gear-level links.
export default function LinkPills({ links }) {
    if (!links || links.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {links.map((link, i) => (
                <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--p-color-info)' }}
                >
                    {link.text || link.url} ↗
                </a>
            ))}
        </div>
    );
}
