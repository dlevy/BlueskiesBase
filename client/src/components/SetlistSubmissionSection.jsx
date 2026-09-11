import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PInlineNotification, PDivider, PSpinner } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import {
    getSetlistSubmissions, getUserSetlistSubmission, saveSetlistSubmission,
    deleteSetlistSubmission, mergeSetlistSubmissionSong, getSongs
} from '../services/api';
import QuickAddSong from './QuickAddSong';

const textareaClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500 resize-none";
const btnPrimary = "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary = "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const selectClass = "rounded-lg border border-white/10 py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--p-color-info)]";

const SET_LABELS = { set1: 'Set 1', set2: 'Set 2', set3: 'Set 3', encore: 'Encore' };

function Spinner() {
    return (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

/**
 * A logged-in fan's best recollection of a show's setlist — even a couple of songs is
 * useful. Kept deliberately separate from the official Setlist card above: submissions
 * show up immediately, attributed by username, but only become part of the official
 * record when an admin pulls individual songs in (the "Add to official setlist" control
 * below, visible to admins only).
 */
export default function SetlistSubmissionSection({ showId }) {
    const { user, isAdmin } = useAuth();

    const [submissions, setSubmissions] = useState([]);
    const [allSongs, setAllSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [mySubmissionId, setMySubmissionId] = useState(null);
    const [mySongs, setMySongs] = useState([]); // [{ song_id, title }]
    const [myNote, setMyNote] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [mergingRowId, setMergingRowId] = useState(null);
    const [mergeTargets, setMergeTargets] = useState({}); // songRowId -> selected set key

    const loadAll = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [{ submissions: all }, songsData] = await Promise.all([
                getSetlistSubmissions(showId),
                getSongs(),
            ]);
            setSubmissions(all || []);
            setAllSongs(songsData.songs || []);

            if (user) {
                const { submission } = await getUserSetlistSubmission(showId);
                if (submission) {
                    setMySubmissionId(submission.id);
                    setMyNote(submission.note || '');
                    setMySongs(submission.setlist_submission_songs.map(row => ({
                        song_id: row.song_id,
                        title: row.songs?.title,
                    })));
                } else {
                    setMySubmissionId(null);
                    setMyNote('');
                    setMySongs([]);
                }
            }
        } catch (err) {
            console.error('Error loading setlist submissions:', err);
            setError('Failed to load community setlist submissions');
        } finally {
            setLoading(false);
        }
    }, [showId, user]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const handleAddSong = (song) => {
        if (mySongs.some(s => s.song_id === song.id)) return; // no duplicates in one submission
        setMySongs(prev => [...prev, { song_id: song.id, title: song.title }]);
    };

    const handleRemoveSong = (index) => {
        setMySongs(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (mySongs.length === 0) { setError('Add at least one song before submitting'); return; }
        try {
            setSaving(true);
            setError(null);
            await saveSetlistSubmission(showId, mySongs.map(s => ({ song_id: s.song_id })), myNote.trim() || null);
            setIsEditing(false);
            await loadAll();
        } catch (err) {
            console.error('Error saving setlist submission:', err);
            setError(err.message || 'Failed to save your submission');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setError(null);
        // Reload to discard any unsaved add/remove changes.
        loadAll();
    };

    const handleDelete = async () => {
        if (!mySubmissionId || !confirm('Remove your setlist submission?')) return;
        try {
            await deleteSetlistSubmission(mySubmissionId);
            await loadAll();
        } catch (err) {
            console.error('Error deleting setlist submission:', err);
            setError('Failed to delete your submission');
        }
    };

    const handleMerge = async (songRowId) => {
        const targetSet = mergeTargets[songRowId] || 'set1';
        try {
            setMergingRowId(songRowId);
            await mergeSetlistSubmissionSong(songRowId, targetSet);
            await loadAll();
        } catch (err) {
            console.error('Error merging song into official setlist:', err);
            setError(err.message || 'Failed to add song to the official setlist');
        } finally {
            setMergingRowId(null);
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 flex items-center gap-3">
                <PSpinner size="small" aria={{ 'aria-label': 'Loading community setlist submissions' }} />
                <PText color="contrast-medium">Loading community setlist submissions…</PText>
            </div>
        );
    }

    // Someone else's submission is shown for everyone; skip rendering the current user's
    // own here since it already has its own editable card above.
    const othersSubmissions = submissions.filter(s => s.id !== mySubmissionId);

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
            <div>
                <PHeading size="lg" tag="h2">Community Setlist</PHeading>
                <PText size="sm" color="contrast-medium">
                    Remember a few songs from this show? Add what you remember — a partial list is welcome.
                </PText>
            </div>
            <PDivider />

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            {/* Your submission */}
            {user ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <PHeading size="sm" tag="h3">Your Submission</PHeading>

                    {!isEditing && mySongs.length === 0 && (
                        <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} onClick={() => setIsEditing(true)}>
                            Add What You Remember
                        </button>
                    )}

                    {!isEditing && mySongs.length > 0 && (
                        <div className="space-y-3">
                            <ol className="space-y-1">
                                {mySongs.map((song, i) => (
                                    <li key={song.song_id} className="text-sm" style={{ color: 'var(--p-color-primary)' }}>
                                        <span className="font-mono text-xs mr-2" style={{ color: 'var(--p-color-contrast-medium)' }}>{i + 1}.</span>
                                        {song.title}
                                    </li>
                                ))}
                            </ol>
                            {myNote && <PText size="xs" color="contrast-medium" className="italic">{myNote}</PText>}
                            <div className="flex gap-2">
                                <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} onClick={() => setIsEditing(true)}>Edit</button>
                                <button className={btnSecondary} style={{ color: 'var(--p-color-notification-error)' }} onClick={handleDelete}>Delete</button>
                            </div>
                        </div>
                    )}

                    {isEditing && (
                        <div className="space-y-3">
                            {mySongs.length > 0 && (
                                <ol className="space-y-1">
                                    {mySongs.map((song, i) => (
                                        <li key={song.song_id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--p-color-primary)' }}>
                                            <span className="font-mono text-xs shrink-0" style={{ color: 'var(--p-color-contrast-medium)' }}>{i + 1}.</span>
                                            <span className="flex-1 min-w-0 truncate">{song.title}</span>
                                            <button type="button" onClick={() => handleRemoveSong(i)}
                                                className="px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-sm shrink-0"
                                                style={{ color: 'var(--p-color-error)' }} title="Remove">
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ol>
                            )}

                            <QuickAddSong
                                allSongs={allSongs}
                                onAddSong={handleAddSong}
                                allowCreate={false}
                                placeholder="Type a song title, press Enter to add…"
                            />

                            <textarea
                                value={myNote}
                                onChange={(e) => setMyNote(e.target.value)}
                                placeholder={'Optional note — e.g. "pretty sure I\'m missing a couple from the encore"'}
                                className={textareaClass}
                                rows="2"
                            />

                            <div className="flex gap-2">
                                <button className={btnPrimary} disabled={saving} onClick={handleSave}>
                                    {saving && <Spinner />}
                                    {saving ? 'Submitting…' : 'Submit'}
                                </button>
                                <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={saving} onClick={handleCancel}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <PText color="contrast-medium">
                    <Link to="/member-login" className="text-amber-400 hover:underline">Log in</Link> to contribute what you remember from this show.
                </PText>
            )}

            {/* Everyone else's submissions */}
            {othersSubmissions.length > 0 && (
                <div className="space-y-3">
                    <PHeading size="sm" tag="h3">
                        {user ? 'Other Submissions' : 'Community Submissions'} ({othersSubmissions.length})
                    </PHeading>
                    {othersSubmissions.map((submission) => (
                        <div key={submission.id} className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <PText size="xs" weight="semi-bold">{submission.profiles?.username || 'Anonymous'}</PText>
                                <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                    {new Date(submission.created_at).toLocaleDateString()}
                                </PText>
                            </div>
                            <ol className="space-y-1">
                                {submission.setlist_submission_songs.map((row) => (
                                    <li key={row.id} className="flex items-center gap-2 text-sm flex-wrap">
                                        <span style={{ color: row.merged_into_setlist ? 'var(--p-color-contrast-low)' : 'var(--p-color-primary)' }}>
                                            {row.song_order}. {row.songs?.title}
                                        </span>
                                        {row.merged_into_setlist ? (
                                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                                style={{ background: 'color-mix(in srgb, var(--p-color-success) 12%, transparent)', color: 'var(--p-color-success)' }}>
                                                In official setlist
                                            </span>
                                        ) : isAdmin && (
                                            <span className="inline-flex items-center gap-1">
                                                <select
                                                    value={mergeTargets[row.id] || 'set1'}
                                                    onChange={e => setMergeTargets(prev => ({ ...prev, [row.id]: e.target.value }))}
                                                    className={selectClass}
                                                    style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                                    {Object.entries(SET_LABELS).map(([key, label]) => (
                                                        <option key={key} value={key}>{label}</option>
                                                    ))}
                                                </select>
                                                <button type="button" onClick={() => handleMerge(row.id)}
                                                    disabled={mergingRowId === row.id}
                                                    className={btnSecondary} style={{ color: 'var(--p-color-info)' }}>
                                                    {mergingRowId === row.id ? 'Adding…' : '+ Add to official setlist'}
                                                </button>
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                            {submission.note && (
                                <PText size="xs" color="contrast-medium" className="italic">{submission.note}</PText>
                            )}
                            {isAdmin && (
                                <PButtonPure size="x-small" icon="delete" onClick={async () => {
                                    if (!confirm('Delete this submission?')) return;
                                    await deleteSetlistSubmission(submission.id);
                                    await loadAll();
                                }}>
                                    Delete
                                </PButtonPure>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {othersSubmissions.length === 0 && !user && (
                <PText color="contrast-medium" align="center">No community submissions yet. Log in to add the first one!</PText>
            )}
        </div>
    );
}
