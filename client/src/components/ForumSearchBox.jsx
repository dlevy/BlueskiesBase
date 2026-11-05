import { useState, useRef, useCallback } from 'react';
import { PSpinner, PText } from '@porsche-design-system/components-react';
import { searchForumThreads } from '../services/api';
import ForumThreadRow from './ForumThreadRow';

const inputClass = "w-full max-w-md rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500";

// Drop-in search box reused on the category and thread pages (the main
// forum page has its own inline version that takes over the whole page on
// a query, which doesn't fit here — a category's thread list or a thread's
// replies should stay visible while searching). categoryId scopes results
// to one category ('other' for uncategorized); omit it to search the whole
// forum.
export default function ForumSearchBox({ categoryId, placeholder = 'Search threads and replies…' }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);
    const debounceRef = useRef(null);

    const runSearch = useCallback((q) => {
        if (!q.trim()) { setResults([]); setSearching(false); return; }
        setSearching(true);
        setError(null);
        searchForumThreads(q.trim(), undefined, categoryId)
            .then(data => setResults(data.results || []))
            .catch(err => {
                console.error('[ForumSearchBox] Error searching forum:', err);
                setError('Search failed');
            })
            .finally(() => setSearching(false));
    }, [categoryId]);

    const handleChange = (value) => {
        setQuery(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSearch(value), 300);
    };

    const isSearching = query.trim().length > 0;

    return (
        <div>
            <input
                type="text"
                value={query}
                onChange={e => handleChange(e.target.value)}
                placeholder={placeholder}
                className={inputClass}
            />
            {isSearching && (
                <div className="mt-3 space-y-2">
                    {searching && (
                        <div className="flex justify-center py-6">
                            <PSpinner size="small" aria={{ 'aria-label': 'Searching forum' }} />
                        </div>
                    )}
                    {!searching && error && (
                        <PText color="notification-error" align="center" className="block py-6">{error}</PText>
                    )}
                    {!searching && !error && results.length === 0 && (
                        <PText color="contrast-medium" align="center" className="block py-6">No threads found.</PText>
                    )}
                    {!searching && !error && results.length > 0 && results.map(thread => (
                        <ForumThreadRow key={thread.id} thread={thread} matchedIn={thread.matched_in} matchingReply={thread.matching_reply} />
                    ))}
                </div>
            )}
        </div>
    );
}
