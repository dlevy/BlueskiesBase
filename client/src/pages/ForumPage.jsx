import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner, PText, PHeading } from '@porsche-design-system/components-react';
import { getForumCategories } from '../services/api';
import { buildCategoryPath } from '../utils/forumSlug';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';

export default function ForumPage() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getForumCategories()
            .then(data => { if (!cancelled) setCategories(data.categories || []); })
            .catch(err => {
                console.error('[ForumPage] Error loading categories:', err);
                if (!cancelled) setError('Failed to load forum categories');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto">
            <SEO
                title="Forum"
                description="Talk Johnny Blue Skies & Sturgill Simpson tours, setlists, posters, and more with other fans."
            />

            <MainNavTabs />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Forum
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    Talk tours, setlists, posters, and more with other fans
                </p>
            </div>

            {loading && (
                <div className="flex justify-center py-16">
                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading forum' }} />
                </div>
            )}

            {!loading && error && (
                <PText color="notification-error" align="center" className="py-16">{error}</PText>
            )}

            {!loading && !error && categories.length === 0 && (
                <PText color="contrast-medium" align="center" className="py-16">
                    No categories yet.
                </PText>
            )}

            {!loading && !error && categories.length > 0 && (
                <div className="space-y-2">
                    {categories.map(category => (
                        <Link
                            key={category.id || 'other'}
                            to={buildCategoryPath(category)}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 hover:border-amber-500/20 hover:bg-white/[0.07] hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 transition-all duration-150 p-4"
                        >
                            <div className="min-w-0">
                                <PHeading size="sm" tag="h2">{category.name}</PHeading>
                                {category.description && (
                                    <PText size="xs" color="contrast-medium" className="block mt-0.5">{category.description}</PText>
                                )}
                            </div>
                            <span className="shrink-0 text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                {category.thread_count} thread{category.thread_count !== 1 ? 's' : ''}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
