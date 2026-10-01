import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PInlineNotification, PDivider, PSpinner } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import { getShowNotes, getUserNote, saveNote, deleteNote } from '../services/api';
import ThanksButton from './ThanksButton';

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

export default function CommentsSection({ showId, thanksRows = [], onThanksChanged }) {
    const { user, isAdmin } = useAuth();
    const [comments, setComments] = useState([]);
    const [userComment, setUserComment] = useState(null);
    const [commentText, setCommentText] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const loadComments = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { notes: allComments } = await getShowNotes(showId);
            setComments(allComments || []);
            if (user) {
                const { note: comment } = await getUserNote(showId);
                setUserComment(comment);
                if (comment) setCommentText(comment.note_text);
            }
        } catch (err) {
            console.error('Error loading comments:', err);
            setError('Failed to load comments');
        } finally {
            setLoading(false);
        }
    }, [showId, user]);

    useEffect(() => { loadComments(); }, [loadComments]);

    const handleSave = async () => {
        if (!commentText.trim()) { setError('Comment cannot be empty'); return; }
        try {
            setSaving(true);
            setError(null);
            const { note: savedComment } = await saveNote(showId, commentText);
            setUserComment(savedComment);
            setIsEditing(false);
            await loadComments();
        } catch (err) {
            console.error('Error saving comment:', err);
            setError('Failed to save comment');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (commentId) => {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        try {
            await deleteNote(commentId);
            if (userComment?.id === commentId) { setUserComment(null); setCommentText(''); setIsEditing(false); }
            await loadComments();
        } catch (err) {
            console.error('Error deleting comment:', err);
            setError('Failed to delete comment');
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setCommentText(userComment?.note_text || '');
        setError(null);
    };

    const handleEditClick = () => {
        setCommentText(userComment?.note_text || '');
        setIsEditing(true);
        setError(null);
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

            {/* Add-comment trigger — only shown before the user has a comment of their own */}
            {user && !userComment && !isEditing && (
                <button className={btnPrimary} onClick={handleEditClick}>
                    Add Comment
                </button>
            )}

            {/* New-comment form — the user doesn't have an existing comment to edit in place yet */}
            {user && !userComment && isEditing && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Share your memories from this show…"
                        className={textareaClass}
                        rows="4"
                    />
                    <div className="flex gap-2">
                        <button className={btnPrimary} disabled={saving} onClick={handleSave}>
                            {saving && <Spinner />}
                            {saving ? 'Posting…' : 'Post Comment'}
                        </button>
                        <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={saving} onClick={handleCancel}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Comments — includes the viewer's own comment, with Edit/Delete inline */}
            {comments.length > 0 && (
                <div className="space-y-3">
                    <PHeading size="sm" tag="h3">Comments ({comments.length})</PHeading>
                    {comments.map((comment) => {
                        const isMine = !!user && comment.user_id === user.id;
                        const commentThanks = thanksRows.filter(t => t.contentType === 'note' && t.contentId === comment.id);

                        if (isMine && isEditing) {
                            return (
                                <div key={comment.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                                    <textarea
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Share your memories from this show…"
                                        className={textareaClass}
                                        rows="4"
                                    />
                                    <div className="flex gap-2">
                                        <button className={btnPrimary} disabled={saving} onClick={handleSave}>
                                            {saving && <Spinner />}
                                            {saving ? 'Posting…' : 'Post Comment'}
                                        </button>
                                        <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={saving} onClick={handleCancel}>Cancel</button>
                                    </div>
                                </div>
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
                                            <PButtonPure size="x-small" icon="edit" onClick={handleEditClick}>
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
                                <PText size="sm">{comment.note_text}</PText>
                            </div>
                        );
                    })}
                </div>
            )}

            {comments.length === 0 && !user && (
                <PText color="contrast-medium" align="center">No comments yet. Sign in to add the first comment!</PText>
            )}
            {comments.length === 0 && user && !userComment && !isEditing && (
                <PText color="contrast-medium" align="center">No comments yet. Be the first to add one!</PText>
            )}
        </div>
    );
}
