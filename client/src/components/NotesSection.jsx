import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getShowNotes, getUserNote, saveNote, deleteNote } from '../services/api';

export default function NotesSection({ showId }) {
    const { user, isAdmin } = useAuth();
    const [notes, setNotes] = useState([]);
    const [userNote, setUserNote] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadNotes();
    }, [showId, user]);

    const loadNotes = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load all notes for the show
            const { notes: allNotes } = await getShowNotes(showId);
            setNotes(allNotes || []);

            // Load user's note if logged in
            if (user) {
                const { note } = await getUserNote(showId);
                setUserNote(note);
                if (note) {
                    setNoteText(note.note_text);
                }
            }
        } catch (err) {
            console.error('Error loading notes:', err);
            setError('Failed to load notes');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!noteText.trim()) {
            setError('Note cannot be empty');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            const { note } = await saveNote(showId, noteText);
            setUserNote(note);
            setIsEditing(false);
            // Reload all notes to show the updated note
            await loadNotes();
        } catch (err) {
            console.error('Error saving note:', err);
            setError('Failed to save note');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (noteId) => {
        if (!confirm('Are you sure you want to delete this note?')) {
            return;
        }

        try {
            await deleteNote(noteId);
            if (userNote && userNote.id === noteId) {
                setUserNote(null);
                setNoteText('');
                setIsEditing(false);
            }
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
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-2xl font-bold text-blue-400 mb-4">Notes</h2>
                <p className="text-gray-400">Loading notes...</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-blue-400 mb-4">Notes</h2>

            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {/* User's Note Section */}
            {user && (
                <div className="mb-6 bg-gray-900 rounded-lg p-4 border border-blue-700">
                    <h3 className="text-lg font-semibold text-blue-300 mb-3">Your Note</h3>
                    
                    {!isEditing && !userNote && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        >
                            Add Your Note
                        </button>
                    )}

                    {!isEditing && userNote && (
                        <div>
                            <p className="text-gray-300 whitespace-pre-wrap mb-3">{userNote.note_text}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(userNote.id)}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    )}

                    {isEditing && (
                        <div>
                            <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Share your memories from this show..."
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                                rows="4"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
                                >
                                    {saving ? 'Saving...' : 'Save Note'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={saving}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* All Notes Section */}
            {notes.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-300 mb-3">
                        Community Notes ({notes.length})
                    </h3>
                    <div className="space-y-4">
                        {notes.map((note) => (
                            <div
                                key={note.id}
                                className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-400 font-medium">
                                            {note.profiles?.username || 'Anonymous'}
                                        </span>
                                        <span className="text-gray-500 text-sm">
                                            {new Date(note.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleDelete(note.id)}
                                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <p className="text-gray-300 whitespace-pre-wrap">{note.note_text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {notes.length === 0 && !user && (
                <p className="text-gray-400 text-center py-4">
                    No notes yet. Sign in to add the first note!
                </p>
            )}

            {notes.length === 0 && user && !userNote && !isEditing && (
                <p className="text-gray-400 text-center py-4">
                    No notes yet. Be the first to add one!
                </p>
            )}
        </div>
    );
}

