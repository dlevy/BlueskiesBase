import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PText, PSpinner } from '@porsche-design-system/components-react';
import { getThreadByShow, startShowDiscussion } from '../services/api';
import { buildThreadPath } from '../utils/forumSlug';
import { useAuth } from '../contexts/AuthContext';

const btnPrimary = "inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-medium border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

// A show-page bar linking out to that show's one forum discussion thread —
// never created automatically, only lazily via the button here (see
// POST /api/forum/threads/for-show), so most shows simply show nothing to
// start until a member actually wants to talk about it.
export default function ForumDiscussionBar({ showId }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [thread, setThread] = useState(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        try {
            const data = await getThreadByShow(showId);
            setThread(data.thread);
        } catch (err) {
            console.error('[ForumDiscussionBar] Error checking for a discussion thread:', err);
        } finally {
            setLoading(false);
        }
    }, [showId]);

    useEffect(() => { load(); }, [load]);

    const handleStart = async () => {
        try {
            setStarting(true);
            setError(null);
            const { thread: newThread } = await startShowDiscussion(showId);
            navigate(buildThreadPath(newThread.id));
        } catch (err) {
            console.error('[ForumDiscussionBar] Error starting discussion:', err);
            setError(err.message || 'Failed to start discussion');
            setStarting(false);
        }
    };

    if (loading) return null;

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-4 flex items-center justify-between gap-3 flex-wrap">
            {thread ? (
                <>
                    <PText size="sm" color="contrast-medium">There's already a discussion happening for this show.</PText>
                    <Link to={buildThreadPath(thread.id)} className="text-sm font-medium hover:underline shrink-0" style={{ color: 'var(--p-color-info)' }}>
                        View Discussion →
                    </Link>
                </>
            ) : user ? (
                <>
                    <PText size="sm" color="contrast-medium">No forum discussion for this show yet.</PText>
                    <button className={btnPrimary} disabled={starting} onClick={handleStart}>
                        {starting ? 'Starting…' : 'Start Discussion'}
                    </button>
                </>
            ) : (
                <PText size="sm" color="contrast-medium">
                    <Link to="/member-login" className="hover:underline" style={{ color: 'var(--p-color-info)' }}>Log in</Link> to start a forum discussion for this show.
                </PText>
            )}
            {error && <PText size="xs" style={{ color: 'var(--p-color-error)' }}>{error}</PText>}
        </div>
    );
}
