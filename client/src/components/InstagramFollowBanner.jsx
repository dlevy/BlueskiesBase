import { useState } from 'react';

const DISMISSED_KEY = 'ig-follow-banner-dismissed';

function getInitiallyDismissed() {
    try { return localStorage.getItem(DISMISSED_KEY) === '1'; }
    catch { return false; }
}

export default function InstagramFollowBanner() {
    const [dismissed, setDismissed] = useState(getInitiallyDismissed);

    if (dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
        try { localStorage.setItem(DISMISSED_KEY, '1'); } catch {}
    };

    return (
        <div
            className="w-full flex items-center justify-center gap-3 px-4 py-2"
            style={{ background: 'rgba(251,191,36,0.1)', borderBottom: '1px solid rgba(251,191,36,0.2)', maxHeight: '75px' }}
        >
            <p className="text-sm text-center" style={{ color: 'var(--p-color-contrast-medium)' }}>
                Follow{' '}
                <a
                    href="https://www.instagram.com/jbssetlists/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-amber-400 hover:underline"
                >
                    @jbssetlists
                </a>
                {' '}for face-melting setlists to your IG feed.
            </p>
            <button
                onClick={handleDismiss}
                aria-label="Dismiss"
                className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/10 transition-colors"
                style={{ color: 'var(--p-color-contrast-medium)' }}
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
