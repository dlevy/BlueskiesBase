import { Link } from 'react-router-dom';
import { buildThreadPath } from '../utils/forumSlug';

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function authorLabel(profile) {
    return profile?.username ? (profile.display_name || profile.username) : 'Anonymous';
}

// Shared by ForumCategoryPage's thread list and ForumPage's search results —
// matchedIn/matchingReply are only set by search, so the category-list usage
// (passing neither) renders identically to before this was extracted.
export default function ForumThreadRow({ thread, matchedIn, matchingReply }) {
    const author = thread.profiles;
    return (
        <Link
            to={buildThreadPath(thread.id)}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 hover:border-amber-500/20 hover:bg-white/[0.07] hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 transition-all duration-150 p-4"
        >
            <div className="min-w-0">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--p-color-primary)' }}>
                    {thread.is_pinned && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Pinned
                        </span>
                    )}
                    {thread.is_locked && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 text-white/60 border border-white/15">
                            Locked
                        </span>
                    )}
                    {thread.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>
                    by {authorLabel(author)} &middot; {formatDate(thread.created_at)}
                </p>
                {matchedIn === 'reply' && matchingReply && (
                    <p className="text-xs mt-1 truncate italic" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Matched in a reply by {authorLabel(matchingReply.profiles)}: "{matchingReply.body.slice(0, 80)}{matchingReply.body.length > 80 ? '…' : ''}"
                    </p>
                )}
            </div>
            <span className="shrink-0 text-xs text-right" style={{ color: 'var(--p-color-contrast-low)' }}>
                {thread.reply_count} repl{thread.reply_count !== 1 ? 'ies' : 'y'}
            </span>
        </Link>
    );
}
