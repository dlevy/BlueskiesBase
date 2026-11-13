import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PSpinner, PText, PHeading, PInlineNotification } from '@porsche-design-system/components-react';
import { getForumCategories, getForumThreads, createForumThread, getMentionableUsers, getShowsWithoutDiscussion, startShowDiscussion } from '../services/api';
import { resolveCategoryBySlug, buildCategoryPath, buildThreadPath } from '../utils/forumSlug';
import { formatVenueLocation } from '../utils/geography';
import { useAuth } from '../contexts/AuthContext';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';
import ForumPostEditor from '../components/ForumPostEditor';
import ForumThreadRow from '../components/ForumThreadRow';
import ForumSearchBox from '../components/ForumSearchBox';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500";
const textareaClass = inputClass + " resize-none";
const btnPrimary = "inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-medium border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary = "inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-medium border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

// show_date is a plain DATE string (YYYY-MM-DD), not a timestamp — parsed
// via its parts directly rather than `new Date(dateString)`, which reads a
// bare date as UTC midnight and can print the wrong day west of UTC.
function formatShowDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function venueLabel(venues) {
    if (!venues) return '';
    return `${venues.name} — ${formatVenueLocation(venues)}`;
}

// The show picker shown in place of the normal new-thread form on the
// show-discussion category's page — that category only ever gets threads
// via "Start Discussion" on a show page or here, never a freeform post, so
// there's always a show to pick rather than a title/body to type.
function ShowDiscussionPicker({ onStarted, onCancel }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startingId, setStartingId] = useState(null);
    const [error, setError] = useState(null);
    const debounceRef = useRef(null);

    const search = useCallback((q) => {
        setLoading(true);
        getShowsWithoutDiscussion(q)
            .then(data => setResults(data.shows || []))
            .catch(err => {
                console.error('[ShowDiscussionPicker] Error searching shows:', err);
                setError('Failed to load shows');
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { search(''); }, [search]);

    const handleQueryChange = (value) => {
        setQuery(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(value), 300);
    };

    const handlePick = async (show) => {
        try {
            setStartingId(show.id);
            setError(null);
            const { thread } = await startShowDiscussion(show.id);
            onStarted(thread.id);
        } catch (err) {
            console.error('[ShowDiscussionPicker] Error starting discussion:', err);
            setError(err.message || 'Failed to start discussion');
            setStartingId(null);
        }
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-3">
            <PHeading size="sm" tag="h2">Start a Show Discussion</PHeading>
            <PText size="xs" color="contrast-medium">Pick a show that doesn't have a discussion yet — the thread title is filled in for you.</PText>
            {error && <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />}
            <input
                type="text"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder="Search by artist, venue, city, or date…"
                className={inputClass}
                autoFocus
            />
            <div className="max-h-80 overflow-y-auto space-y-1.5">
                {loading ? (
                    <div className="flex justify-center py-6"><PSpinner size="small" aria={{ 'aria-label': 'Searching shows' }} /></div>
                ) : results.length === 0 ? (
                    <PText size="sm" color="contrast-medium" align="center" className="py-4 block">
                        {query ? 'No matching shows without a discussion yet.' : 'Every show already has a discussion!'}
                    </PText>
                ) : (
                    results.map(show => (
                        <button
                            key={show.id}
                            type="button"
                            disabled={startingId !== null}
                            onClick={() => handlePick(show)}
                            className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 hover:border-amber-500/20 hover:bg-white/10 transition-all px-3 py-2 disabled:opacity-50"
                        >
                            <span className="min-w-0">
                                <span className="block text-sm font-medium truncate" style={{ color: 'var(--p-color-primary)' }}>{show.artist_name}</span>
                                <span className="block text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>{venueLabel(show.venues)}</span>
                            </span>
                            <span className="shrink-0 text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                {startingId === show.id ? 'Starting…' : formatShowDate(show.show_date)}
                            </span>
                        </button>
                    ))
                )}
            </div>
            <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={startingId !== null} onClick={onCancel}>
                Cancel
            </button>
        </div>
    );
}

export default function ForumCategoryPage() {
    const { categorySlug } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [resolving, setResolving] = useState(true);
    const [category, setCategory] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [resolveError, setResolveError] = useState(false);
    const [threads, setThreads] = useState([]);
    const [loadingThreads, setLoadingThreads] = useState(true);
    const [error, setError] = useState(null);

    const [showNewThreadForm, setShowNewThreadForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);
    const [members, setMembers] = useState([]);

    useEffect(() => {
        if (!user) return;
        getMentionableUsers()
            .then(data => setMembers(data.users || []))
            .catch(err => console.error('[ForumCategoryPage] Error loading mentionable users:', err));
    }, [user]);

    useEffect(() => {
        let cancelled = false;
        getForumCategories()
            .then(data => {
                if (cancelled) return;
                const resolved = resolveCategoryBySlug(data.categories || [], categorySlug);
                if (!resolved) { setNotFound(true); return; }
                setCategory(resolved);
            })
            .catch(err => {
                console.error('[ForumCategoryPage] Error loading categories:', err);
                // A fetch failure here doesn't mean the category doesn't exist —
                // kept separate from notFound so a transient failure (exactly the
                // kind a crawler's renderer can hit) never gets noindexed.
                if (!cancelled) setResolveError(true);
            })
            .finally(() => { if (!cancelled) setResolving(false); });
        return () => { cancelled = true; };
    }, [categorySlug]);

    const loadThreads = useCallback(() => {
        if (!category) return;
        setLoadingThreads(true);
        getForumThreads(category.id || 'other')
            .then(data => setThreads(data.threads || []))
            .catch(err => {
                console.error('[ForumCategoryPage] Error loading threads:', err);
                setError('Failed to load threads');
            })
            .finally(() => setLoadingThreads(false));
    }, [category]);

    useEffect(() => { loadThreads(); }, [loadThreads]);

    const handleSubmitNewThread = async () => {
        if (!newTitle.trim() || !newBody.trim()) { setFormError('Title and body are required'); return; }
        try {
            setSaving(true);
            setFormError(null);
            const { thread } = await createForumThread(category.id, newTitle, newBody);
            navigate(buildThreadPath(thread.id));
        } catch (err) {
            console.error('[ForumCategoryPage] Error creating thread:', err);
            setFormError(err.message || 'Failed to create thread');
        } finally {
            setSaving(false);
        }
    };

    if (resolving) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto">
                <MainNavTabs />
                <div className="flex justify-center py-16"><PSpinner size="medium" aria={{ 'aria-label': 'Loading' }} /></div>
            </div>
        );
    }

    // No <SEO noindex> here — a fetch failure doesn't mean the category
    // doesn't exist, so the robots tag is left exactly as it already is.
    if (resolveError) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto space-y-4">
                <MainNavTabs />
                <PInlineNotification heading="Could not load category" description="Something went wrong loading this page. Please try refreshing." state="error" dismissButton={false} />
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto space-y-4">
                <SEO title="Category Not Found" noindex />
                <MainNavTabs />
                <PInlineNotification heading="Category not found" description="We couldn't find a forum category at this URL." state="error" dismissButton={false} />
                <Link to="/forum" className={btnSecondary}>Back to Forum</Link>
            </div>
        );
    }

    const isShowDiscussion = !!category.is_show_discussion_category;

    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto space-y-6">
            <SEO
                title={`${category.name} — Forum`}
                description={category.description || `Threads in ${category.name}`}
                path={buildCategoryPath(category)}
            />

            <MainNavTabs />

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Link to="/forum" className="text-xs hover:underline" style={{ color: 'var(--p-color-contrast-low)' }}>&larr; Forum</Link>
                    <h1 className="font-display font-bold text-2xl mt-1" style={{ color: 'var(--p-color-primary)' }}>
                        {category.name}
                    </h1>
                    {category.description && (
                        <p className="text-sm mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>{category.description}</p>
                    )}
                </div>
                {user && category.id && !showNewThreadForm && (
                    <button className={btnPrimary} onClick={() => setShowNewThreadForm(true)}>
                        {isShowDiscussion ? 'Start a Show Discussion' : 'New Thread'}
                    </button>
                )}
            </div>

            <ForumSearchBox categoryId={category.id || 'other'} placeholder={`Search ${category.name}…`} />

            {showNewThreadForm && isShowDiscussion && (
                <ShowDiscussionPicker
                    onStarted={(threadId) => navigate(buildThreadPath(threadId))}
                    onCancel={() => setShowNewThreadForm(false)}
                />
            )}

            {showNewThreadForm && !isShowDiscussion && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-3">
                    <PHeading size="sm" tag="h2">New Thread</PHeading>
                    {formError && <PInlineNotification heading="Error" description={formError} state="error" dismissButton={false} />}
                    <input
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Thread title"
                        maxLength={200}
                        className={inputClass}
                    />
                    <ForumPostEditor
                        value={newBody}
                        onChange={setNewBody}
                        members={members}
                        placeholder="What's on your mind? (type @ to mention someone)"
                        rows={6}
                        className={textareaClass}
                    />
                    <div className="flex gap-2">
                        <button className={btnPrimary} disabled={saving} onClick={handleSubmitNewThread}>
                            {saving ? 'Posting…' : 'Post Thread'}
                        </button>
                        <button
                            className={btnSecondary}
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                            disabled={saving}
                            onClick={() => { setShowNewThreadForm(false); setNewTitle(''); setNewBody(''); setFormError(null); }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {loadingThreads ? (
                <div className="flex justify-center py-16"><PSpinner size="medium" aria={{ 'aria-label': 'Loading threads' }} /></div>
            ) : error ? (
                <PText color="notification-error" align="center" className="py-16">{error}</PText>
            ) : threads.length === 0 ? (
                <PText color="contrast-medium" align="center" className="py-16">
                    No discussions yet. {user ? (isShowDiscussion ? 'Start one above, or from any show page.' : 'Start the first one!') : 'Sign in to start one.'}
                </PText>
            ) : (
                <div className="space-y-2">
                    {threads.map(thread => <ForumThreadRow key={thread.id} thread={thread} />)}
                </div>
            )}
        </div>
    );
}
