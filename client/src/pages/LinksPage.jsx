import { useState, useEffect } from 'react';
import { PSpinner, PText, PHeading } from '@porsche-design-system/components-react';
import { getLinks, getLinkCategories } from '../services/api';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';

function LinkCard({ link }) {
    return (
        <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-amber-500/30 hover:bg-white/[0.05] transition-all"
        >
            <div className="flex items-start justify-between gap-3">
                <PText weight="semi-bold">{link.title}</PText>
                <span className="text-amber-400 shrink-0">→</span>
            </div>
            {link.description && (
                <PText size="small" color="contrast-medium" className="mt-1 block">{link.description}</PText>
            )}
        </a>
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
                <div className="space-y-8">
                    {sections.map(({ category, links: categoryLinks }) => (
                        <div key={category.id}>
                            <PHeading size="lg" tag="h2" className="mb-3">{category.name}</PHeading>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {categoryLinks.map(link => <LinkCard key={link.id} link={link} />)}
                            </div>
                        </div>
                    ))}

                    {otherLinks.length > 0 && (
                        <div>
                            <PHeading size="lg" tag="h2" className="mb-3">Other</PHeading>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {otherLinks.map(link => <LinkCard key={link.id} link={link} />)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
