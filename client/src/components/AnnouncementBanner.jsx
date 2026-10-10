import { trackEvent } from '../utils/analytics';

// The standing fallback — shown whenever there's no custom banner
// configured, a custom banner's schedule has ended, or the site settings
// fetch fails outright. This used to be the site's only banner, hardcoded
// with no admin controls; now it's just the default everything else falls
// back to.
export const DEFAULT_BANNER = {
    enabled: true,
    prefixText: 'Follow',
    linkText: '@jbssetlists',
    linkUrl: 'https://www.instagram.com/jbssetlists/',
    suffixText: 'for face-melting setlists to your IG feed.',
    color: '#fbbf24',
    scheduledOffAt: null,
};

// Site-wide announcement bar — admin-editable (text, color, an optional
// hyperlinked phrase, a scheduled revert-to-default time) via Site
// Settings. No dismiss button: an admin controls visibility with the
// `enabled` flag instead of each visitor dismissing it individually.
// `banner` is the raw saved settings, or `null` while still loading —
// renders nothing in that case rather than flashing DEFAULT_BANNER first
// and then swapping to the real one once the fetch resolves.
export default function AnnouncementBanner({ banner }) {
    if (!banner) return null;
    if (!banner.enabled) return null;

    // A schedule that's passed reverts the *content* to the standing
    // default — the banner keeps showing, just not the custom one anymore.
    // The admin's saved custom text/color/schedule stay untouched in
    // site_settings either way; this only changes what's displayed.
    const scheduleExpired = banner.scheduledOffAt && new Date(banner.scheduledOffAt) <= new Date();
    const effective = scheduleExpired ? DEFAULT_BANNER : banner;

    const { prefixText, linkText, linkUrl, suffixText, color } = effective;
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
