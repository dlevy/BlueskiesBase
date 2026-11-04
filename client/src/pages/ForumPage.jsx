import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner, PText, PHeading } from '@porsche-design-system/components-react';
import { getForumCategories, searchForumThreads } from '../services/api';
import { buildCategoryPath } from '../utils/forumSlug';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';
import ForumThreadRow from '../components/ForumThreadRow';

const inputClass = "flex-1 min-w-[200px] max-w-md rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500";

export default function ForumPage() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const debounceRef = useRef(null);

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

    const runSearch = useCallback((q) => {
        if (!q.trim()) { setResults([]); setSearching(false); return; }
        setSearching(true);
        setSearchError(null);
        searchForumThreads(q.trim())
            .then(data => setResults(data.results || []))
            .catch(err => {
                console.error('[ForumPage] Error searching forum:', err);
                setSearchError('Search failed');
            })
            .finally(() => setSearching(false));
    }, []);

    const handleQueryChange = (value) => {
        setQuery(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSearch(value), 300);
    };

    const isSearching = query.trim().length > 0;

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
                <input
                    type="text"
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    placeholder="Search threads and replies…"
                    className={inputClass + " mt-3"}
                />
            </div>

            {isSearching ? (
                <>
                    {searching && (
                        <div className="flex justify-center py-16">
                            <PSpinner size="medium" aria={{ 'aria-label': 'Searching forum' }} />
                        </div>
                    )}
                    {!searching && searchError && (
                        <PText color="notification-error" align="center" className="py-16">{searchError}</PText>
                    )}
                    {!searching && !searchError && results.length === 0 && (
                        <PText color="contrast-medium" align="center" className="py-16">
                            No threads found.
                        </PText>
                    )}
                    {!searching && !searchError && results.length > 0 && (
                        <div className="space-y-2">
                            {results.map(thread => (
                                <ForumThreadRow key={thread.id} thread={thread} matchedIn={thread.matched_in} matchingReply={thread.matching_reply} />
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <>
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
                </>
            )}
        </div>
    );
}
