import { useState, useEffect, useCallback } from 'react';
import { PHeading, PText, PButtonPure, PInlineNotification, PDivider, PSpinner } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import { getShowNotes, getUserNote, saveNote, deleteNote } from '../services/api';

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

export default function NotesSection({ showId }) {
    const { user, isAdmin } = useAuth();
    const [notes, setNotes] = useState([]);
    const [userNote, setUserNote] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const loadNotes = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { notes: allNotes } = await getShowNotes(showId);
            setNotes(allNotes || []);
            if (user) {
                const { note } = await getUserNote(showId);
                setUserNote(note);
                if (note) setNoteText(note.note_text);
            }
        } catch (err) {
            console.error('Error loading notes:', err);
            setError('Failed to load notes');
        } finally {
            setLoading(false);
        }
    }, [showId, user]);

    useEffect(() => { loadNotes(); }, [loadNotes]);

    const handleSave = async () => {
        if (!noteText.trim()) { setError('Note cannot be empty'); return; }
        try {
            setSaving(true);
            setError(null);
            const { note } = await saveNote(showId, noteText);
            setUserNote(note);
            setIsEditing(false);
            await loadNotes();
        } catch (err) {
            console.error('Error saving note:', err);
            setError('Failed to save note');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (noteId) => {
        if (!confirm('Are you sure you want to delete this note?')) return;
        try {
            await deleteNote(noteId);
            if (userNote?.id === noteId) { setUserNote(null); setNoteText(''); setIsEditing(false); }
            await loadNotes();
        } catch (err) {
            console.error('Error deleting note:', err);
            setError('Failed to delete note');
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setNoteText(userNote?.note_text || '');
        setError(null);
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 flex items-center gap-3">
                <PSpinner size="small" aria={{ 'aria-label': 'Loading notes' }} />
                <PText color="contrast-medium">Loading notes…</PText>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
            <PHeading size="lg" tag="h2">Notes</PHeading>
            <PDivider />

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            {/* User's own note */}
            {user && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <PHeading size="sm" tag="h3">Your Note</PHeading>

                    {!isEditing && !userNote && (
                        <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} onClick={() => setIsEditing(true)}>
                            Add Your Note
                        </button>
                    )}

                    {!isEditing && userNote && (
                        <div className="space-y-3">
                            <PText size="sm">{userNote.note_text}</PText>
                            <div className="flex gap-2">
                                <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} onClick={() => setIsEditing(true)}>Edit</button>
                                <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} onClick={() => handleDelete(userNote.id)}>Delete</button>
                            </div>
                        </div>
                    )}

                    {isEditing && (
                        <div className="space-y-3">
                            <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Share your memories from this show…"
                                className={textareaClass}
                                rows="4"
                            />
                            <div className="flex gap-2">
                                <button className={btnPrimary} disabled={saving} onClick={handleSave}>
                                    {saving && <Spinner />}
                                    {saving ? 'Saving…' : 'Save Note'}
                                </button>
                                <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={saving} onClick={handleCancel}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Community notes */}
            {notes.length > 0 && (
                <div className="space-y-3">
                    <PHeading size="sm" tag="h3">Community Notes ({notes.length})</PHeading>
                    {notes.map((note) => (
                        <div key={note.id} className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PText size="xs" weight="semi-bold">{note.profiles?.username || 'Anonymous'}</PText>
                                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>{new Date(note.created_at).toLocaleDateString()}</PText>
                                </div>
                                {isAdmin && (
                                    <PButtonPure size="x-small" icon="delete" onClick={() => handleDelete(note.id)}>
                                        Delete
                                    </PButtonPure>
                                )}
                            </div>
                            <PText size="sm">{note.note_text}</PText>
                        </div>
                    ))}
                </div>
            )}

            {notes.length === 0 && !user && (
                <PText color="contrast-medium" align="center">No notes yet. Sign in to add the first note!</PText>
            )}
            {notes.length === 0 && user && !userNote && !isEditing && (
                <PText color="contrast-medium" align="center">No notes yet. Be the first to add one!</PText>
            )}
        </div>
    );
}
