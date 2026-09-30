import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner, PText, PHeading } from '@porsche-design-system/components-react';
import { getLinks, getLinkCategories, getMemberSocialLinks } from '../services/api';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';
import Avatar from '../components/Avatar';

const SOCIAL_PLATFORMS = [
    { key: 'facebookUrl', label: 'Facebook' },
    { key: 'redditUrl', label: 'Reddit' },
    { key: 'instagramUrl', label: 'Instagram' },
    { key: 'youtubeUrl', label: 'YouTube' },
];

function MemberLinksCard({ member }) {
    const name = member.displayName || member.username;
    const platforms = SOCIAL_PLATFORMS.filter(p => member[p.key]);

    return (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 hover:border-amber-500/30 hover:bg-white/[0.05] transition-all">
            <Link to={`/profile/${member.username}`} className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
                <Avatar url={member.avatarUrl} name={name} size="sm" />
                <PText size="small" weight="semi-bold" ellipsis>{name}</PText>
            </Link>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                {platforms.map(p => (
                    <a key={p.key} href={member[p.key]} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-amber-400 hover:opacity-80 transition-opacity">
                        {p.label} →
                    </a>
                ))}
            </div>
        </div>
    );
}

function LinkCard({ link }) {
    const member = link.member;
    return (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 hover:border-amber-500/30 hover:bg-white/[0.05] transition-all">
            {/* Its own <a>, not nested inside the member <Link> below */}
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <PText size="small" weight="semi-bold" ellipsis>{link.title}</PText>
                    {link.description && (
                        <PText size="x-small" color="contrast-medium" className="block mt-0.5">{link.description}</PText>
                    )}
                </div>
                <span className="text-amber-400 shrink-0 text-sm">→</span>
            </a>
            {member && (
                <Link
                    to={`/profile/${member.username}`}
                    className="flex items-center gap-1.5 mt-1 hover:opacity-80 transition-opacity"
                >
                    <Avatar url={member.avatar_url} name={member.display_name || member.username} size="sm" />
                    <PText size="xs" color="contrast-medium">
                        by {member.display_name || member.username}
                    </PText>
                </Link>
            )}
        </div>
    );
}

export default function LinksPage() {
    const [categories, setCategories] = useState([]);
    const [links, setLinks] = useState([]);
    const [memberLinks, setMemberLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        Promise.all([getLinks(), getLinkCategories(), getMemberSocialLinks()])
            .then(([linksData, categoriesData, memberLinksData]) => {
                if (cancelled) return;
                setLinks(linksData.links || []);
                setCategories(categoriesData.categories || []);
                setMemberLinks(memberLinksData.members || []);
            })
            .catch(err => {
                console.error('[LinksPage] Error loading links:', err);
                if (!cancelled) setError('Failed to load links');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    // Group links by category, in the admin-defined category order; links with
    // no category (or whose category was since deleted) fall into "Other".
    const linksByCategory = new Map();
    const otherLinks = [];
    links.forEach(link => {
        if (link.category_id) {
            if (!linksByCategory.has(link.category_id)) linksByCategory.set(link.category_id, []);
            linksByCategory.get(link.category_id).push(link);
        } else {
            otherLinks.push(link);
        }
    });

    const sections = categories
        .map(category => ({ category, links: linksByCategory.get(category.id) || [] }))
        .filter(section => section.links.length > 0);

    return (
        <div className="px-4 py-4 md:py-6 max-w-6xl mx-auto">
            <SEO
                title="Links"
                description="Links to news articles, video channels, communities, and poster artists affiliated with Johnny Blue Skies and Sturgill Simpson."
            />

            <MainNavTabs />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Links
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    Other JBS-affiliated sites worth knowing about
                </p>
            </div>

            {loading && (
                <div className="flex justify-center py-16">
                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading links' }} />
                </div>
            )}

            {!loading && error && (
                <PText color="notification-error" align="center" className="py-16">{error}</PText>
            )}

            {!loading && !error && sections.length === 0 && otherLinks.length === 0 && (
                <PText color="contrast-medium" align="center" className="py-16">
                    No links added yet.
                </PText>
            )}

            {!loading && !error && (
                // CSS multi-column layout, not a grid — each category block gets
                // break-inside-avoid-column so it never splits across columns;
                // shorter categories simply pack in wherever they fit.
                <div className="columns-1 md:columns-2 gap-6">
                    {sections.map(({ category, links: categoryLinks }) => (
                        <div key={category.id} className="break-inside-avoid-column mb-6">
                            <PHeading size="lg" tag="h2" className="mb-2">{category.name}</PHeading>
                            <div className="space-y-2">
                                {categoryLinks.map(link => <LinkCard key={link.id} link={link} />)}
                            </div>
                        </div>
                    ))}

                    {otherLinks.length > 0 && (
                        <div className="break-inside-avoid-column mb-6">
                            <PHeading size="lg" tag="h2" className="mb-2">Other</PHeading>
                            <div className="space-y-2">
                                {otherLinks.map(link => <LinkCard key={link.id} link={link} />)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!loading && !error && memberLinks.length > 0 && (
                <div className="mt-2 pt-6 border-t border-white/10">
                    <PHeading size="lg" tag="h2" className="mb-1">Member Links</PHeading>
                    <PText size="small" color="contrast-medium" className="block mb-3">
                        Social links shared by SkySets.org members on their profiles
                    </PText>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {memberLinks.map(member => <MemberLinksCard key={member.id} member={member} />)}
                    </div>
                </div>
            )}
        </div>
    );
}
