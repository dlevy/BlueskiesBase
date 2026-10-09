import { trackEvent } from '../utils/analytics';

// Site-wide announcement bar — admin-editable (text, color, an optional
// hyperlinked phrase within the text) via Site Settings. No dismiss button:
// an admin controls visibility with the `enabled` flag instead of each
// visitor dismissing it individually.
export default function AnnouncementBanner({ banner }) {
    if (!banner?.enabled) return null;

    const { prefixText, linkText, linkUrl, suffixText, color } = banner;
    if (!prefixText && !(linkText && linkUrl) && !suffixText) return null;

    const accent = color || '#fbbf24';

    return (
        <div
            className="w-full flex items-center justify-center px-4 py-2"
            style={{
                background: `color-mix(in srgb, ${accent} 10%, transparent)`,
                borderBottom: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`,
                maxHeight: '75px',
            }}
        >
            <p className="text-sm text-center" style={{ color: 'var(--p-color-contrast-medium)' }}>
                {prefixText && <>{prefixText}{' '}</>}
                {linkText && linkUrl && (
                    <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold hover:underline"
                        style={{ color: accent }}
                        onClick={() => trackEvent('banner_link_clicked')}
                    >
                        {linkText}
                    </a>
                )}
                {suffixText && <>{' '}{suffixText}</>}
            </p>
        </div>
    );
}
