import { useState, useEffect } from 'react';
import { PSpinner, PText, PHeading } from '@porsche-design-system/components-react';
import { getLinks, getLinkCategories } from '../services/api';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';

// A plain row, not its own bordered card — the category it lives in already
// provides one shared card, so every individual link just needs a hover
// highlight and a hairline divider from its neighbor, not another box of
// its own. That's what made the page read as a wall of boxes before.
function LinkRow({ link }) {
    const member = link.member;
    return (
        <div className="flex items-start justify-between gap-3 py-2.5 px-1 rounded-lg hover:bg-white/5 transition-colors">
            <a
                href={link.url}
                target="_blank"
                rel={link.nofollow ? 'noopener noreferrer nofollow' : 'noopener noreferrer'}
                className="min-w-0 flex-1"
            >
                <PText size="small" weight="semi-bold" ellipsis>{link.title}</PText>
                {link.description && (
                    <PText size="x-small" color="contrast-medium" className="block mt-0.5">{link.description}</PText>
                )}
                {member && (
                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="block mt-0.5">
                        submitted by {member.display_name || member.username}
                    </PText>
                )}
            </a>
            <span className="text-amber-400 shrink-0 text-sm mt-0.5">→</span>
        </div>
    );
}

export default function LinksPage() {
    const [categories, setCategories] = useState([]);
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        Promise.all([getLinks(), getLinkCategories()])
            .then(([linksData, categoriesData]) => {
                if (cancelled) return;
                setLinks(linksData.links || []);
                setCategories(categoriesData.categories || []);
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
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-6xl mx-auto">
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
                        <div key={category.id} className="break-inside-avoid-column mb-6 rounded-2xl border border-white/10 bg-[#1a1e26] p-4">
                            <PHeading size="lg" tag="h2" className="mb-1">{category.name}</PHeading>
                            <div className="divide-y divide-white/5">
                                {categoryLinks.map(link => <LinkRow key={link.id} link={link} />)}
                            </div>
                        </div>
                    ))}

                    {otherLinks.length > 0 && (
                        <div className="break-inside-avoid-column mb-6 rounded-2xl border border-white/10 bg-[#1a1e26] p-4">
                            <PHeading size="lg" tag="h2" className="mb-1">Other</PHeading>
                            <div className="divide-y divide-white/5">
                                {otherLinks.map(link => <LinkRow key={link.id} link={link} />)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
