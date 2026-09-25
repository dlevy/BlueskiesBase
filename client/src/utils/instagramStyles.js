// Curated visual themes for the Instagram setlist-post generator. Layout
// stays identical across styles — only color/background vary — so adding a
// style here never requires touching the renderer.
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
];

export const DEFAULT_STYLE_KEY = POST_STYLES[0].key;

export function getStyleByKey(key) {
    return POST_STYLES.find(s => s.key === key) || POST_STYLES[0];
}

// Single fixed post size (4:5) — no format picker; every post is this size.
export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1350;
