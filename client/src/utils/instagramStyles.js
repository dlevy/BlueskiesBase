// Curated visual themes for the Instagram setlist-post generator. A tour gets
// assigned one of these (see tour_post_styles table) so every post from that
// tour looks consistent, while different tours can look distinct from one
// another. Layout stays identical across styles — only color/background vary —
// so adding a style here never requires touching the renderer.
export const POST_STYLES = [
    {
        key: 'amber-black',
        label: 'Amber / Black',
        background: '#0b0e13',
        panelBackground: 'rgba(255,255,255,0.03)',
        accent: '#fbbf24',
        heading: '#f5f5f5',
        body: '#c7cdd6',
        muted: '#7c8590',
        divider: 'rgba(255,255,255,0.1)',
    },
    {
        key: 'slate-cream',
        label: 'Slate / Cream',
        background: '#f5f1e8',
        panelBackground: 'rgba(15,23,42,0.04)',
        accent: '#334155',
        heading: '#1e293b',
        body: '#475569',
        // Was #94a3b8 — only 2.3:1 against this background, below the WCAG AA
        // floor even for large text, so song numbers/dates were hard to read.
        muted: '#64748b',
        divider: 'rgba(15,23,42,0.12)',
    },
    {
        key: 'deep-red-white',
        label: 'Deep Red / White',
        background: '#1a0303',
        panelBackground: 'rgba(255,255,255,0.04)',
        accent: '#f87171',
        heading: '#fff5f5',
        body: '#e7c9c9',
        muted: '#a17070',
        divider: 'rgba(255,255,255,0.12)',
    },
    {
        key: 'forest-gold',
        label: 'Forest / Gold',
        background: '#0c1a12',
        panelBackground: 'rgba(255,255,255,0.03)',
        accent: '#d4af37',
        heading: '#f2f7f3',
        body: '#bfd0c4',
        muted: '#6f8a78',
        divider: 'rgba(255,255,255,0.1)',
    },
    {
        key: 'midnight-ice',
        label: 'Midnight / Ice',
        background: '#05070d',
        panelBackground: 'rgba(255,255,255,0.03)',
        accent: '#7dd3fc',
        heading: '#f8fafc',
        body: '#cbd5e1',
        muted: '#64748b',
        divider: 'rgba(255,255,255,0.1)',
    },
    {
        key: 'violet-gold',
        label: 'Violet Dusk / Gold',
        background: '#140b1f',
        panelBackground: 'rgba(255,255,255,0.03)',
        accent: '#facc15',
        heading: '#f5f0ff',
        body: '#d8cce8',
        muted: '#8b7a9e',
        divider: 'rgba(255,255,255,0.1)',
    },
    {
        key: 'rust-cream',
        label: 'Rust / Cream',
        background: '#f7ece0',
        panelBackground: 'rgba(15,23,42,0.04)',
        accent: '#c2410c',
        heading: '#431407',
        body: '#7c4a2d',
        // Was #b08968 — only 2.7:1 against this background, below the WCAG AA
        // floor even for large text, so song numbers/dates were hard to read.
        muted: '#8b5e3c',
        divider: 'rgba(15,23,42,0.12)',
    },
    {
        key: 'charcoal-neon',
        label: 'Charcoal / Neon Green',
        background: '#0a0a0a',
        panelBackground: 'rgba(255,255,255,0.03)',
        accent: '#4ade80',
        heading: '#f1f5f1',
        body: '#c8d6c8',
        muted: '#5f6f5f',
        divider: 'rgba(255,255,255,0.1)',
    },
];

export const DEFAULT_STYLE_KEY = POST_STYLES[0].key;

export function getStyleByKey(key) {
    return POST_STYLES.find(s => s.key === key) || POST_STYLES[0];
}

export const POST_FORMATS = [
    { key: 'square', label: 'Feed – Square', width: 1080, height: 1080 },
    { key: 'portrait', label: 'Feed – Portrait', width: 1080, height: 1350 },
    { key: 'story', label: 'Story', width: 1080, height: 1920 },
];

export const DEFAULT_FORMAT_KEY = POST_FORMATS[0].key;

export function getFormatByKey(key) {
    return POST_FORMATS.find(f => f.key === key) || POST_FORMATS[0];
}
