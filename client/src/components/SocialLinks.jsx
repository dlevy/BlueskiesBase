import SocialIcon, { SOCIAL_PLATFORMS } from './SocialIcon';

// Icon-only row of whichever social platforms `source` (a profile or member
// directory entry — both use the same facebookUrl/redditUrl/instagramUrl/
// youtubeUrl shape) has set. Shared by ProfilePage and MembersPage so the
// two don't drift into different treatments of the same data.
export default function SocialLinks({ source, size = 20, className = 'flex items-center gap-3', iconClassName = 'text-amber-400 hover:opacity-80 transition-opacity' }) {
    const active = SOCIAL_PLATFORMS.filter(p => source?.[p.key]);
    if (active.length === 0) return null;

    return (
        <div className={className}>
            {active.map(p => (
                <a
                    key={p.key}
                    href={source[p.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={p.label}
                    title={p.label}
                    className={iconClassName}
                >
                    <SocialIcon platform={p.key} size={size} />
                </a>
            ))}
        </div>
    );
}
