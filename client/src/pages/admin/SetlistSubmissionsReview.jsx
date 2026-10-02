import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllSetlistSubmissions, mergeSetlistSubmissionSong, mergeAllSetlistSubmissionSongs, deleteSetlistSubmission } from '../../services/api';
import { buildShowPath } from '../../utils/showSlug';

const SET_LABELS = { set1: 'Set 1', set2: 'Set 2', set3: 'Set 3', encore: 'Encore' };
const selectClass = "rounded-lg border border-white/10 py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--p-color-info)]";
const btnSecondary = "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

// Same "pull this song into the official setlist" control as
// SetlistSubmissionSection.jsx's own copy — duplicated rather than shared
// since the two live in otherwise-unrelated pages.
function MergeControl({ merging, target, onTargetChange, onMerge }) {
    return (
        <span className="inline-flex items-center gap-1">
            <select
                value={target || 'set1'}
                onChange={e => onTargetChange(e.target.value)}
                className={selectClass}
                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                {Object.entries(SET_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                ))}
            </select>
            <button type="button" onClick={onMerge} disabled={merging}
                className={btnSecondary} style={{ color: 'var(--p-color-info)' }}>
                {merging ? 'Adding…' : '+ Add to official setlist'}
            </button>
        </span>
    );
}

const MergedBadge = () => (
    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
        style={{ background: 'color-mix(in srgb, var(--p-color-success) 12%, transparent)', color: 'var(--p-color-success)' }}>
        In official setlist
    </span>
);

function formatShowDate(dateString) {
    // show_date is a plain DATE column (YYYY-MM-DD) — parse the parts
    // directly rather than `new Date(dateString)`, which reads it as UTC
    // midnight and can print the wrong day in a timezone west of UTC.
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Admin/editor review queue for every community setlist submission across
 * every show — not just the ones that happen to have fired a "needs review"
 * notification, so past submissions that were missed stay reachable too.
 * Accepting a song here is the same action as the "Add to official setlist"
 * control on the public show page (POST /songs/:songRowId/merge).
 */
export default function SetlistSubmissionsReview() {
    const { isAdmin } = useAuth();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hideMerged, setHideMerged] = useState(true);
    const [mergingRowId, setMergingRowId] = useState(null);
    const [mergeTargets, setMergeTargets] = useState({});
    const [mergingAllId, setMergingAllId] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { submissions: all } = await getAllSetlistSubmissions();
            setSubmissions(all || []);
        } catch (err) {
            console.error('Error loading setlist submissions:', err);
            setError('Failed to load setlist submissions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleMerge = async (songRowId) => {
        const targetSet = mergeTargets[songRowId] || 'set1';
        try {
            setMergingRowId(songRowId);
            await mergeSetlistSubmissionSong(songRowId, targetSet);
            await load();
        } catch (err) {
            console.error('Error merging song into official setlist:', err);
            setError(err.message || 'Failed to add song to the official setlist');
        } finally {
            setMergingRowId(null);
        }
    };

    const handleMergeAll = async (submission) => {
        const pendingSongs = submission.setlist_submission_songs.filter(row => !row.merged_into_setlist);
        if (!confirm(
            `Accept all ${pendingSongs.length} remaining song${pendingSongs.length === 1 ? '' : 's'} into the official setlist? ` +
            'Each uses its currently selected set (defaulting to Set 1) — you can still remove one afterward from the show\'s setlist editor if something\'s wrong.'
        )) return;
        try {
            setMergingAllId(submission.id);
            const targets = {};
            for (const row of pendingSongs) targets[row.id] = mergeTargets[row.id] || 'set1';
            await mergeAllSetlistSubmissionSongs(submission.id, targets);
            await load();
        } catch (err) {
            console.error('Error accepting all songs into the official setlist:', err);
            setError(err.message || 'Failed to accept all songs into the official setlist');
        } finally {
            setMergingAllId(null);
        }
    };

    const handleDelete = async (submissionId) => {
        if (!confirm('Delete this submission?')) return;
        try {
            await deleteSetlistSubmission(submissionId);
            await load();
        } catch (err) {
            console.error('Error deleting submission:', err);
            setError('Failed to delete submission');
        }
    };

    const withStatus = useMemo(() => submissions.map(s => ({
        ...s,
        allMerged: s.setlist_submission_songs.length > 0 && s.setlist_submission_songs.every(row => row.merged_into_setlist),
        pendingSongsCount: s.setlist_submission_songs.filter(row => !row.merged_into_setlist).length,
    })), [submissions]);

    const pendingCount = withStatus.filter(s => !s.allMerged).length;
    const visible = hideMerged ? withStatus.filter(s => !s.allMerged) : withStatus;

    if (loading) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <PHeading size="2xl" tag="h1">Setlist Submissions</PHeading>
                <PText size="small" color="contrast-medium">
                    Every community setlist correction, across every show — accept one into the official setlist, or just review what's come in.
                </PText>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            <div className="flex flex-wrap items-center gap-4">
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-4">
                    <div className="text-3xl font-bold" style={{ color: 'var(--p-color-info)' }}>{pendingCount}</div>
                    <PText size="small" color="contrast-medium">Pending Review</PText>
                </div>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    <input type="checkbox" checked={hideMerged} onChange={e => setHideMerged(e.target.checked)} />
                    Hide fully-accepted submissions
                </label>
            </div>

            {visible.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-8 text-center">
                    <PText color="contrast-medium">
                        {hideMerged ? 'Nothing pending review.' : 'No setlist submissions yet.'}
                    </PText>
                </div>
            ) : (
                <div className="space-y-3">
                    {visible.map((submission) => (
                        <div key={submission.id} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 space-y-3">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                    {submission.shows ? (
                                        <Link to={`${buildShowPath(submission.shows)}#submission-${submission.id}`} className="hover:underline">
                                            <PText weight="semi-bold">
                                                {formatShowDate(submission.shows.show_date)} — {submission.shows.artist_name}
                                            </PText>
                                        </Link>
                                    ) : (
                                        <PText weight="semi-bold" color="contrast-medium">Show no longer exists</PText>
                                    )}
                                    {submission.shows?.venues && (
                                        <PText size="xs" color="contrast-medium">
                                            {submission.shows.venues.name ? `${submission.shows.venues.name}, ` : ''}
                                            {submission.shows.venues.city}{submission.shows.venues.state_country ? `, ${submission.shows.venues.state_country}` : ''}
                                        </PText>
                                    )}
                                </div>
                                <div className="text-right shrink-0 space-y-1.5">
                                    <PText size="xs" weight="semi-bold">{submission.profiles?.username || 'Anonymous'}</PText>
                                    <PText size="xs" color="contrast-medium">{new Date(submission.created_at).toLocaleDateString()}</PText>
                                    {submission.pendingSongsCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleMergeAll(submission)}
                                            disabled={mergingAllId === submission.id}
                                            className={btnSecondary}
                                            style={{ color: 'var(--p-color-success)' }}
                                        >
                                            {mergingAllId === submission.id ? 'Accepting…' : `Accept All (${submission.pendingSongsCount})`}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <ol className="space-y-1">
                                {submission.setlist_submission_songs.map(row => (
                                    <li key={row.id} className="flex items-center gap-2 text-sm flex-wrap">
                                        <span style={{ color: row.merged_into_setlist ? 'var(--p-color-contrast-low)' : 'var(--p-color-primary)' }}>
                                            {row.song_order}. {row.songs?.title}
                                        </span>
                                        {row.merged_into_setlist ? (
                                            <MergedBadge />
                                        ) : (
                                            <MergeControl
                                                merging={mergingRowId === row.id}
                                                target={mergeTargets[row.id]}
                                                onTargetChange={value => setMergeTargets(prev => ({ ...prev, [row.id]: value }))}
                                                onMerge={() => handleMerge(row.id)}
                                            />
                                        )}
                                    </li>
                                ))}
                            </ol>

                            {submission.note && (
                                <PText size="xs" color="contrast-medium" className="italic">{submission.note}</PText>
                            )}

                            {isAdmin && (
                                <div className="flex justify-end">
                                    <PButtonPure size="x-small" icon="delete" onClick={() => handleDelete(submission.id)}>
                                        Delete
                                    </PButtonPure>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
