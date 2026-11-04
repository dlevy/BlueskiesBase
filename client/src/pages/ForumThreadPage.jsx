import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PSpinner, PText, PHeading, PInlineNotification, PButtonPure, PDivider } from '@porsche-design-system/components-react';
import {
    getForumThread, updateForumThread, deleteForumThread, moderateForumThread, reportForumThread,
    createForumReply, updateForumReply, deleteForumReply, reportForumReply, getMentionableUsers,
    getThreadThanks, getThreadSubscription, subscribeToThread, unsubscribeFromThread,
} from '../services/api';
import { buildCategoryPath } from '../utils/forumSlug';
import { buildShowPath } from '../utils/showSlug';
import { useAuth } from '../contexts/AuthContext';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';
import MentionTextarea from '../components/MentionTextarea';
import ThanksButton from '../components/ThanksButton';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500";
const textareaClass = inputClass + " resize-none";
const btnPrimary = "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary = "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const REPORT_REASONS = ['spam', 'inappropriate'];

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Same @handle linkification as CommentsSection.jsx.
function renderWithMentions(text, usernameSet) {
    if (!usernameSet || usernameSet.size === 0) return text;
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
        const m = part.match(/^@([a-zA-Z0-9_]+)$/);
        if (m && usernameSet.has(m[1].toLowerCase())) {
            return (
                <Link key={i} to={`/profile/${m[1].toLowerCase()}`} className="hover:underline" style={{ color: 'var(--p-color-primary)' }}>
                    {part}
                </Link>
            );
        }
        return <Fragment key={i}>{part}</Fragment>;
    });
}

function AuthorLine({ profile, dateString, editedAt }) {
    return (
        <p className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
            {profile?.username
                ? <Link to={`/profile/${profile.username}`} className="hover:underline" style={{ color: 'var(--p-color-contrast-medium)' }}>{profile.display_name || profile.username}</Link>
                : (profile?.display_name || 'Anonymous')}
            {' · '}{formatDateTime(dateString)}
            {editedAt && ' (edited)'}
        </p>
    );
}

// A reply built via the Quote button leads with consecutive "> "-prefixed
// lines — split those off and render them as a blockquote, same convention
// as email/old-school forum quoting. Anything typed manually with a leading
// "> " line quotes the same way, not just quote-button output. Only a
// *leading* block is special-cased (not quotes embedded mid-message) to
// keep this simple — matches exactly what the Quote button itself produces.
function splitLeadingQuote(text) {
    const lines = text.split('\n');
    let i = 0;
    while (i < lines.length && lines[i].startsWith('> ')) i++;
    if (i === 0) return { quote: null, rest: text };
    return { quote: lines.slice(0, i).map(l => l.slice(2)).join('\n'), rest: lines.slice(i).join('\n') };
}

function buildQuote(text, username) {
    const quotedLines = text.trim().split('\n').map(l => `> ${l}`).join('\n');
    return `${quotedLines}\n— @${username}\n\n`;
}

function PostBody({ text, usernameSet }) {
    const { quote, rest } = splitLeadingQuote(text);
    return (
        <>
            {quote && (
                <blockquote
                    className="border-l-2 pl-3 italic text-sm mb-2"
                    style={{ borderColor: 'rgba(245,158,11,0.3)', color: 'var(--p-color-contrast-medium)' }}
                >
                    {renderWithMentions(quote, usernameSet)}
                </blockquote>
            )}
            <PText size="sm" className="whitespace-pre-wrap">{renderWithMentions(rest, usernameSet)}</PText>
        </>
    );
}

// Shared reason/note report panel — same shape as PhotosSection.jsx's photo
// report UI, with forum's own reason set (spam/inappropriate).
function ReportPanel({ onSubmit, onCancel, submitting, error }) {
    const [reason, setReason] = useState(null);
    const [note, setNote] = useState('');
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2.5 mt-2">
            <PText size="xs" style={{ color: 'var(--p-color-contrast-medium)' }}>Why are you reporting this?</PText>
            <div className="flex gap-2">
                {REPORT_REASONS.map(r => (
                    <button
                        key={r}
                        className={r === reason ? btnPrimary : btnSecondary}
                        style={r === reason ? undefined : { color: 'var(--p-color-contrast-medium)' }}
                        onClick={() => setReason(r)}
                    >
                        {r === 'spam' ? 'Spam' : 'Inappropriate'}
                    </button>
                ))}
            </div>
            <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                maxLength={280}
                className={inputClass}
            />
            {error && <PText size="xs" style={{ color: 'var(--p-color-error)' }}>{error}</PText>}
            <div className="flex gap-2">
                <button className={btnPrimary} disabled={submitting || !reason} onClick={() => onSubmit(reason, note)}>
                    {submitting ? 'Submitting…' : 'Submit Report'}
                </button>
                <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={submitting} onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

export default function ForumThreadPage() {
    const { threadId } = useParams();
    const navigate = useNavigate();
    const { user, isEditorOrAdmin } = useAuth();

    const [thread, setThread] = useState(null);
    const [replies, setReplies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState(null);
    const [members, setMembers] = useState([]);

    const [editingThread, setEditingThread] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editBody, setEditBody] = useState('');
    const [saving, setSaving] = useState(false);

    const [replyBody, setReplyBody] = useState('');
    const [postingReply, setPostingReply] = useState(false);
    const [editingReplyId, setEditingReplyId] = useState(null);
    const [editReplyBody, setEditReplyBody] = useState('');

    const [reportingKey, setReportingKey] = useState(null); // 'thread' or reply id
    const [reportedKeys, setReportedKeys] = useState(new Set());
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportError, setReportError] = useState(null);

    const [thanksRows, setThanksRows] = useState([]);
    const [subscribed, setSubscribed] = useState(false);
    const [subscribing, setSubscribing] = useState(false);
    const replySectionRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        getMentionableUsers()
            .then(data => setMembers(data.users || []))
            .catch(err => console.error('[ForumThreadPage] Error loading mentionable users:', err));
    }, [user]);

    const usernameSet = useMemo(() => new Set(members.map(m => m.username.toLowerCase())), [members]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getForumThread(threadId);
            setThread(data.thread);
            setReplies(data.replies || []);
        } catch (err) {
            console.error('[ForumThreadPage] Error loading thread:', err);
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    }, [threadId]);

    useEffect(() => { load(); }, [load]);

    const loadThanks = useCallback(async () => {
        try {
            const data = await getThreadThanks(threadId);
            setThanksRows(data.thanks || []);
        } catch (err) {
            console.error('[ForumThreadPage] Error loading thanks:', err);
        }
    }, [threadId]);

    useEffect(() => { loadThanks(); }, [loadThanks]);

    useEffect(() => {
        if (!user) { setSubscribed(false); return; }
        getThreadSubscription(threadId)
            .then(data => setSubscribed(!!data.subscribed))
            .catch(err => console.error('[ForumThreadPage] Error loading subscription state:', err));
    }, [user, threadId]);

    const handleToggleSubscription = async () => {
        if (subscribing) return;
        try {
            setSubscribing(true);
            if (subscribed) {
                await unsubscribeFromThread(threadId);
                setSubscribed(false);
            } else {
                await subscribeToThread(threadId);
                setSubscribed(true);
            }
        } catch (err) {
            console.error('[ForumThreadPage] Error toggling subscription:', err);
            setError(err.message || 'Failed to update subscription');
        } finally {
            setSubscribing(false);
        }
    };

    const handleQuote = (text, username) => {
        const quote = buildQuote(text, username);
        setReplyBody(prev => prev ? `${prev}\n\n${quote}` : quote);
        replySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleSaveThreadEdit = async () => {
        if (!editTitle.trim() || !editBody.trim()) { setError('Title and body are required'); return; }
        try {
            setSaving(true);
            setError(null);
            await updateForumThread(threadId, editTitle, editBody);
            setEditingThread(false);
            await load();
        } catch (err) {
            console.error('[ForumThreadPage] Error updating thread:', err);
            setError(err.message || 'Failed to update thread');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteThread = async () => {
        if (!confirm('Delete this thread? This also deletes every reply in it.')) return;
        try {
            await deleteForumThread(threadId);
            navigate(thread.category_id ? buildCategoryPath(thread.forum_categories) : '/forum/other');
        } catch (err) {
            console.error('[ForumThreadPage] Error deleting thread:', err);
            setError(err.message || 'Failed to delete thread');
        }
    };

    const handleModerate = async (updates) => {
        try {
            await moderateForumThread(threadId, updates);
            await load();
        } catch (err) {
            console.error('[ForumThreadPage] Error moderating thread:', err);
            setError(err.message || 'Failed to update thread');
        }
    };

    const handlePostReply = async () => {
        if (!replyBody.trim()) return;
        try {
            setPostingReply(true);
            setError(null);
            await createForumReply(threadId, replyBody);
            setReplyBody('');
            setSubscribed(true);
            await load();
        } catch (err) {
            console.error('[ForumThreadPage] Error posting reply:', err);
            setError(err.message || 'Failed to post reply');
        } finally {
            setPostingReply(false);
        }
    };

    const handleSaveReplyEdit = async (replyId) => {
        if (!editReplyBody.trim()) return;
        try {
            setSaving(true);
            await updateForumReply(replyId, editReplyBody);
            setEditingReplyId(null);
            await load();
        } catch (err) {
            console.error('[ForumThreadPage] Error updating reply:', err);
            setError(err.message || 'Failed to update reply');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteReply = async (replyId) => {
        if (!confirm('Delete this reply?')) return;
        try {
            await deleteForumReply(replyId);
            await load();
        } catch (err) {
            console.error('[ForumThreadPage] Error deleting reply:', err);
            setError(err.message || 'Failed to delete reply');
        }
    };

    const handleSubmitReport = async (key, reason, note) => {
        try {
            setReportSubmitting(true);
            setReportError(null);
            if (key === 'thread') await reportForumThread(threadId, reason, note);
            else await reportForumReply(key, reason, note);
            setReportedKeys(prev => new Set(prev).add(key));
            setReportingKey(null);
        } catch (err) {
            console.error('[ForumThreadPage] Error submitting report:', err);
            setReportError(err.message || 'Failed to submit report');
        } finally {
            setReportSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto">
                <MainNavTabs />
                <div className="flex justify-center py-16"><PSpinner size="medium" aria={{ 'aria-label': 'Loading thread' }} /></div>
            </div>
        );
    }

    if (notFound || !thread) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto space-y-4">
                <SEO title="Thread Not Found" noindex />
                <MainNavTabs />
                <PInlineNotification heading="Thread not found" description="We couldn't find this thread." state="error" dismissButton={false} />
                <Link to="/forum" className={btnSecondary}>Back to Forum</Link>
            </div>
        );
    }

    const isMine = !!user && thread.user_id === user.id;
    const categoryPath = thread.category_id ? buildCategoryPath(thread.forum_categories) : '/forum/other';
    const bodyPreview = thread.body.length > 160 ? `${thread.body.slice(0, 160)}…` : thread.body;
    const threadThanks = thanksRows.filter(t => t.contentType === 'forum_thread' && t.contentId === thread.id);

    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto space-y-6">
            <SEO title={thread.title} description={bodyPreview} path={`/forum/thread/${thread.id}`} />

            <MainNavTabs />

            <Link to={categoryPath} className="text-xs hover:underline" style={{ color: 'var(--p-color-contrast-low)' }}>
                &larr; {thread.forum_categories?.name || 'Other'}
            </Link>

            {thread.shows && (
                <Link
                    to={buildShowPath(thread.shows)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors px-4 py-2.5"
                >
                    <span className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Discussing: <strong style={{ color: 'var(--p-color-primary)' }}>{thread.shows.artist_name}</strong>
                        {thread.shows.venues && <> — {thread.shows.venues.name}, {thread.shows.venues.city}</>}
                        {thread.shows.is_cancelled && <span className="ml-1.5 text-red-400">(Canceled)</span>}
                    </span>
                    <span className="shrink-0 text-xs" style={{ color: 'var(--p-color-info)' }}>View Show →</span>
                </Link>
            )}

            {error && <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />}

            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-3">
                {editingThread ? (
                    <div className="space-y-3">
                        <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={200} className={inputClass} />
                        <MentionTextarea value={editBody} onChange={setEditBody} members={members} rows={6} className={textareaClass} />
                        <div className="flex gap-2">
                            <button className={btnPrimary} disabled={saving} onClick={handleSaveThreadEdit}>{saving ? 'Saving…' : 'Save'}</button>
                            <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={saving} onClick={() => setEditingThread(false)}>Cancel</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {thread.is_pinned && (
                                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Pinned</span>
                                    )}
                                    {thread.is_locked && (
                                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 text-white/60 border border-white/15">Locked</span>
                                    )}
                                    <PHeading size="large" tag="h1">{thread.title}</PHeading>
                                </div>
                                <AuthorLine profile={thread.profiles} dateString={thread.created_at} editedAt={thread.edited_at} />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <ThanksButton
                                    contentType="forum_thread"
                                    contentId={thread.id}
                                    count={threadThanks.length}
                                    thankedByMe={!!user && threadThanks.some(t => t.thankedBy === user.id)}
                                    thankedByNames={threadThanks.map(t => t.thankedByName)}
                                    isOwnContent={isMine}
                                    onToggled={loadThanks}
                                />
                                {user && (
                                    <PButtonPure size="x-small" icon="bell" disabled={subscribing} onClick={handleToggleSubscription}>
                                        {subscribed ? 'Unsubscribe' : 'Subscribe'}
                                    </PButtonPure>
                                )}
                                {user && !thread.is_locked && (
                                    <PButtonPure size="x-small" icon="chat" hideLabel title="Quote this post" onClick={() => handleQuote(thread.body, thread.profiles?.username || 'someone')}>
                                        Quote
                                    </PButtonPure>
                                )}
                                {isMine && (
                                    <PButtonPure size="x-small" icon="edit" onClick={() => { setEditTitle(thread.title); setEditBody(thread.body); setEditingThread(true); }}>
                                        Edit
                                    </PButtonPure>
                                )}
                                {((isMine && replies.length === 0) || isEditorOrAdmin) && (
                                    <PButtonPure size="x-small" icon="delete" onClick={handleDeleteThread}>Delete</PButtonPure>
                                )}
                                {isEditorOrAdmin && (
                                    <PButtonPure size="x-small" icon={thread.is_pinned ? 'minus' : 'plus'} onClick={() => handleModerate({ is_pinned: !thread.is_pinned })}>
                                        {thread.is_pinned ? 'Unpin' : 'Pin'}
                                    </PButtonPure>
                                )}
                                {isEditorOrAdmin && (
                                    <PButtonPure size="x-small" icon={thread.is_locked ? 'lock-open' : 'lock'} onClick={() => handleModerate({ is_locked: !thread.is_locked })}>
                                        {thread.is_locked ? 'Unlock' : 'Lock'}
                                    </PButtonPure>
                                )}
                                {user && !isMine && (
                                    reportedKeys.has('thread') ? (
                                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>Reported</PText>
                                    ) : (
                                        <PButtonPure size="x-small" icon="warning" hideLabel title="Report this thread" onClick={() => setReportingKey(reportingKey === 'thread' ? null : 'thread')}>
                                            Report
                                        </PButtonPure>
                                    )
                                )}
                            </div>
                        </div>
                        <PostBody text={thread.body} usernameSet={usernameSet} />
                        {reportingKey === 'thread' && (
                            <ReportPanel
                                submitting={reportSubmitting}
                                error={reportError}
                                onCancel={() => { setReportingKey(null); setReportError(null); }}
                                onSubmit={(reason, note) => handleSubmitReport('thread', reason, note)}
                            />
                        )}
                    </>
                )}
            </div>

            <div className="space-y-3">
                <PHeading size="sm" tag="h2">{replies.length} Repl{replies.length !== 1 ? 'ies' : 'y'}</PHeading>
                <PDivider />

                {replies.map(reply => {
                    const replyIsMine = !!user && reply.user_id === user.id;
                    const replyThanks = thanksRows.filter(t => t.contentType === 'forum_reply' && t.contentId === reply.id);
                    return (
                        <div key={reply.id} className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-2">
                            {editingReplyId === reply.id ? (
                                <div className="space-y-2">
                                    <MentionTextarea value={editReplyBody} onChange={setEditReplyBody} members={members} rows={4} className={textareaClass} />
                                    <div className="flex gap-2">
                                        <button className={btnPrimary} disabled={saving} onClick={() => handleSaveReplyEdit(reply.id)}>{saving ? 'Saving…' : 'Save'}</button>
                                        <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={saving} onClick={() => setEditingReplyId(null)}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between gap-2">
                                        <AuthorLine profile={reply.profiles} dateString={reply.created_at} editedAt={reply.edited_at} />
                                        <div className="flex items-center gap-2 shrink-0">
                                            <ThanksButton
                                                contentType="forum_reply"
                                                contentId={reply.id}
                                                count={replyThanks.length}
                                                thankedByMe={!!user && replyThanks.some(t => t.thankedBy === user.id)}
                                                thankedByNames={replyThanks.map(t => t.thankedByName)}
                                                isOwnContent={replyIsMine}
                                                onToggled={loadThanks}
                                            />
                                            {user && !thread.is_locked && (
                                                <PButtonPure size="x-small" icon="chat" hideLabel title="Quote this reply" onClick={() => handleQuote(reply.body, reply.profiles?.username || 'someone')}>
                                                    Quote
                                                </PButtonPure>
                                            )}
                                            {replyIsMine && (
                                                <PButtonPure size="x-small" icon="edit" hideLabel title="Edit" onClick={() => { setEditingReplyId(reply.id); setEditReplyBody(reply.body); }}>
                                                    Edit
                                                </PButtonPure>
                                            )}
                                            {(replyIsMine || isEditorOrAdmin) && (
                                                <PButtonPure size="x-small" icon="delete" hideLabel title="Delete" onClick={() => handleDeleteReply(reply.id)}>
                                                    Delete
                                                </PButtonPure>
                                            )}
                                            {user && !replyIsMine && (
                                                reportedKeys.has(reply.id) ? (
                                                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>Reported</PText>
                                                ) : (
                                                    <PButtonPure size="x-small" icon="warning" hideLabel title="Report this reply" onClick={() => setReportingKey(reportingKey === reply.id ? null : reply.id)}>
                                                        Report
                                                    </PButtonPure>
                                                )
                                            )}
                                        </div>
                                    </div>
                                    <PostBody text={reply.body} usernameSet={usernameSet} />
                                    {reportingKey === reply.id && (
                                        <ReportPanel
                                            submitting={reportSubmitting}
                                            error={reportError}
                                            onCancel={() => { setReportingKey(null); setReportError(null); }}
                                            onSubmit={(reason, note) => handleSubmitReport(reply.id, reason, note)}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}

                {replies.length === 0 && (
                    <PText color="contrast-medium" align="center" className="py-6">No replies yet.</PText>
                )}
            </div>

            {user ? (
                thread.is_locked ? (
                    <PText color="contrast-medium" align="center">This thread is locked — no new replies.</PText>
                ) : (
                    <div ref={replySectionRef} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-3">
                        <PHeading size="sm" tag="h2">Reply</PHeading>
                        <MentionTextarea
                            value={replyBody}
                            onChange={setReplyBody}
                            members={members}
                            placeholder="Write a reply… (type @ to mention someone)"
                            rows={4}
                            className={textareaClass}
                        />
                        <button className={btnPrimary} disabled={postingReply || !replyBody.trim()} onClick={handlePostReply}>
                            {postingReply ? 'Posting…' : 'Post Reply'}
                        </button>
                    </div>
                )
            ) : (
                <PText color="contrast-medium" align="center">
                    <Link to="/member-login" className="hover:underline" style={{ color: 'var(--p-color-info)' }}>Log in</Link> to reply.
                </PText>
            )}
        </div>
    );
}
