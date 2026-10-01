import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PInlineNotification, PDivider, PSpinner } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import { getShowNotes, addNote, updateNote, deleteNote, getMentionableUsers } from '../services/api';
import ThanksButton from './ThanksButton';
import MentionTextarea from './MentionTextarea';

// Splits comment text on @handles and links any that match a known username
// (case-insensitively) to that member's profile; unmatched @tokens (or none
// of the mentionable list loaded, e.g. for a logged-out visitor) render as
// plain text.
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

const textareaClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500 resize-none";
const btnPrimary = "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary = "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

function Spinner() {
    return (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

function CommentForm({ value, onChange, onSave, onCancel, saving, saveLabel, savingLabel, members }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <MentionTextarea
                value={value}
                onChange={onChange}
                members={members}
                placeholder="Share your memories from this show… (type @ to mention someone)"
                rows={4}
                className={textareaClass}
            />
            <div className="flex gap-2">
                <button className={btnPrimary} disabled={saving} onClick={onSave}>
                    {saving && <Spinner />}
                    {saving ? savingLabel : saveLabel}
                </button>
                <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={saving} onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
}

export default function CommentsSection({ showId, thanksRows = [], onThanksChanged }) {
    const { user, isAdmin } = useAuth();
    const [comments, setComments] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [commentText, setCommentText] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [members, setMembers] = useState([]);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        getMentionableUsers()
            .then(data => { if (!cancelled) setMembers(data.users || []); })
            .catch(err => console.error('Error loading mentionable users:', err));
        return () => { cancelled = true; };
    }, [user]);

    const usernameSet = useMemo(() => new Set(members.map(m => m.username.toLowerCase())), [members]);

    const loadComments = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { notes: allComments } = await getShowNotes(showId);
            setComments(allComments || []);
        } catch (err) {
            console.error('Error loading comments:', err);
            setError('Failed to load comments');
        } finally {
            setLoading(false);
        }
    }, [showId]);

    useEffect(() => { loadComments(); }, [loadComments]);

    const handleAddClick = () => {
        setShowAddForm(true);
        setEditingCommentId(null);
        setCommentText('');
        setError(null);
    };

    const handleEditClick = (comment) => {
        setEditingCommentId(comment.id);
        setShowAddForm(false);
        setCommentText(comment.note_text);
        setError(null);
    };

    const handleCancel = () => {
        setShowAddForm(false);
        setEditingCommentId(null);
        setCommentText('');
        setError(null);
    };

    const handleSaveNew = async () => {
        if (!commentText.trim()) { setError('Comment cannot be empty'); return; }
        try {
            setSaving(true);
            setError(null);
            await addNote(showId, commentText);
            setShowAddForm(false);
            setCommentText('');
            await loadComments();
        } catch (err) {
            console.error('Error posting comment:', err);
            setError('Failed to post comment');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!commentText.trim()) { setError('Comment cannot be empty'); return; }
        try {
            setSaving(true);
            setError(null);
            await updateNote(editingCommentId, commentText);
            setEditingCommentId(null);
            setCommentText('');
            await loadComments();
        } catch (err) {
            console.error('Error updating comment:', err);
            setError('Failed to update comment');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (commentId) => {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        try {
            await deleteNote(commentId);
            if (editingCommentId === commentId) { setEditingCommentId(null); setCommentText(''); }
            await loadComments();
        } catch (err) {
            console.error('Error deleting comment:', err);
            setError('Failed to delete comment');
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 flex items-center gap-3">
                <PSpinner size="small" aria={{ 'aria-label': 'Loading comments' }} />
                <PText color="contrast-medium">Loading comments…</PText>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
            <PHeading size="lg" tag="h2">Comments</PHeading>
            <PDivider />

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            {user && !showAddForm && (
                <button className={btnPrimary} onClick={handleAddClick}>
                    Add Comment
                </button>
            )}

            {user && showAddForm && (
                <CommentForm
                    value={commentText}
                    onChange={setCommentText}
                    onSave={handleSaveNew}
                    onCancel={handleCancel}
                    saving={saving}
                    saveLabel="Post Comment"
                    savingLabel="Posting…"
                    members={members}
                />
            )}

            {comments.length > 0 && (
                <div className="space-y-3">
                    <PHeading size="sm" tag="h3">Comments ({comments.length})</PHeading>
                    {comments.map((comment) => {
                        const isMine = !!user && comment.user_id === user.id;
                        const commentThanks = thanksRows.filter(t => t.contentType === 'note' && t.contentId === comment.id);

                        if (editingCommentId === comment.id) {
                            return (
                                <CommentForm
                                    key={comment.id}
                                    value={commentText}
                                    onChange={setCommentText}
                                    onSave={handleSaveEdit}
                                    onCancel={handleCancel}
                                    saving={saving}
                                    saveLabel="Save"
                                    savingLabel="Saving…"
                                    members={members}
                                />
                            );
                        }

                        return (
                            <div key={comment.id} className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <PText size="xs" weight="semi-bold">
                                            {comment.profiles?.username
                                                ? <Link to={`/profile/${comment.profiles.username}`} className="hover:underline">{comment.profiles.display_name || comment.profiles.username}</Link>
                                                : 'Anonymous'}
                                        </PText>
                                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>{new Date(comment.created_at).toLocaleDateString()}</PText>
                                        <ThanksButton
                                            contentType="note"
                                            contentId={comment.id}
                                            count={commentThanks.length}
                                            thankedByMe={!!user && commentThanks.some(t => t.thankedBy === user.id)}
                                            thankedByNames={commentThanks.map(t => t.thankedByName)}
                                            isOwnContent={isMine}
                                            onToggled={onThanksChanged}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        {isMine && (
                                            <PButtonPure size="x-small" icon="edit" onClick={() => handleEditClick(comment)}>
                                                Edit
                                            </PButtonPure>
                                        )}
                                        {(isMine || isAdmin) && (
                                            <PButtonPure size="x-small" icon="delete" onClick={() => handleDelete(comment.id)}>
                                                Delete
                                            </PButtonPure>
                                        )}
                                    </div>
                                </div>
                                <PText size="sm">{renderWithMentions(comment.note_text, usernameSet)}</PText>
                            </div>
                        );
                    })}
                </div>
            )}

            {comments.length === 0 && !user && (
                <PText color="contrast-medium" align="center">No comments yet. Sign in to add the first comment!</PText>
            )}
            {comments.length === 0 && user && !showAddForm && (
                <PText color="contrast-medium" align="center">No comments yet. Be the first to add one!</PText>
            )}
        </div>
    );
}
