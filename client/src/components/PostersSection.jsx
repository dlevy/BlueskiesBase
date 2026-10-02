import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PInlineNotification, PDivider } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import { getShowPoster, uploadPoster, updatePosterDetails, deletePoster, getPosterShows, linkPosterToRange, unlinkPosterShow } from '../services/api';
import ThanksButton from './ThanksButton';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

function formatShortDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

// Editor/admin-only tool for linking a single poster image to a whole run of
// shows (e.g. one poster used for an entire tour leg), so it appears on every
// one of those shows' pages but only once, as a date range, on the public
// Posters gallery. Lives inline on the poster it applies to rather than as a
// separate admin page — the natural place to reach for it is the show whose
// poster this already is.
function PosterLinkManager({ poster, showDate }) {
    const [open, setOpen] = useState(false);
    const [linkedShows, setLinkedShows] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState(showDate || '');
    const [endDate, setEndDate] = useState(showDate || '');
    const [applying, setApplying] = useState(false);
    const [result, setResult] = useState(null);

    const loadLinkedShows = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { shows } = await getPosterShows(poster.id);
            setLinkedShows(shows || []);
        } catch (err) {
            console.error('Error loading linked shows:', err);
            setError('Failed to load linked shows');
        } finally {
            setLoading(false);
        }
    }, [poster.id]);

    useEffect(() => {
        if (open && linkedShows === null) loadLinkedShows();
    }, [open, linkedShows, loadLinkedShows]);

    const handleApply = async () => {
        if (!startDate || !endDate) return;
        try {
            setApplying(true);
            setError(null);
            setResult(null);
            const res = await linkPosterToRange(poster.id, startDate, endDate);
            setResult(res);
            await loadLinkedShows();
        } catch (err) {
            console.error('Error linking poster to range:', err);
            setError(err.message || 'Failed to link poster to shows');
        } finally {
            setApplying(false);
        }
    };

    const handleUnlink = async (showId) => {
        if (!confirm('Unlink this show from the poster? It will need its own poster afterward.')) return;
        try {
            setError(null);
            await unlinkPosterShow(poster.id, showId);
            await loadLinkedShows();
        } catch (err) {
            console.error('Error unlinking show:', err);
            setError(err.message || 'Failed to unlink show');
        }
    };

    return (
        <div className="pt-2">
            <PButtonPure size="x-small" icon={open ? 'arrow-up' : 'arrow-down'} onClick={() => setOpen(o => !o)}>
                {open ? 'Hide' : 'Manage'} tour poster links
            </PButtonPure>

            {open && (
                <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
                    {error && <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />}

                    {loading ? (
                        <PText size="xs" color="contrast-medium">Loading linked shows…</PText>
                    ) : (
                        <div className="space-y-1">
                            <PText size="xs" weight="semi-bold" color="contrast-medium">
                                Linked to {linkedShows?.length ?? 0} show{linkedShows?.length === 1 ? '' : 's'}
                            </PText>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {(linkedShows || []).map(s => (
                                    <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                                        <span style={{ color: 'var(--p-color-contrast-medium)' }}>
                                            {formatShortDate(s.show_date)}
                                            {s.venues && <span style={{ color: 'var(--p-color-contrast-low)' }}> — {s.venues.city}</span>}
                                        </span>
                                        {(linkedShows?.length || 0) > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleUnlink(s.id)}
                                                className="shrink-0 hover:opacity-80 transition-opacity"
                                                style={{ color: 'var(--p-color-error)' }}
                                            >
                                                Unlink
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <PDivider />

                    <div className="space-y-2">
                        <PText size="xs" weight="semi-bold" color="contrast-medium">
                            Link to more shows by date range
                        </PText>
                        <div className="flex flex-wrap items-end gap-2">
                            <div>
                                <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Start</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                    className="rounded-lg border border-white/10 bg-white/5 py-1.5 px-2 text-xs" />
                            </div>
                            <div>
                                <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>End</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                    className="rounded-lg border border-white/10 bg-white/5 py-1.5 px-2 text-xs" />
                            </div>
                            <button
                                type="button"
                                disabled={applying || !startDate || !endDate}
                                onClick={handleApply}
                                className="h-[30px] px-3 rounded-lg text-xs font-medium border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {applying ? 'Applying…' : 'Apply'}
                            </button>
                        </div>
                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                            Matches every show by this artist in that date range that doesn't already have its own poster.
                        </PText>

                        {result && (
                            <div className="text-xs space-y-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                <p>Linked {result.linked.length} show{result.linked.length === 1 ? '' : 's'}.</p>
                                {result.skipped.length > 0 && (
                                    <p style={{ color: 'var(--p-color-contrast-low)' }}>
                                        Skipped {result.skipped.length} (already ha{result.skipped.length === 1 ? 's' : 've'} a different poster): {result.skipped.map(s => formatShortDate(s.show_date)).join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500";
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

// One variant slot (regular or foil) — its own upload form, display, and delete,
// independent of the other variant. Additional (non-primary) posters reuse this
// for display/delete only — replacing a specific additional poster isn't a
// supported concept (every additional upload is always a fresh one), so the
// upload/replace affordance is disabled for those and adding more happens via
// the separate "+ Add Additional Poster" form instead.
function PosterSlot({ label, poster, isFoil, showId, showDate, user, isAdmin, isEditorOrAdmin, onImageClick, onChanged, thanksRows = [], onThanksChanged, additional = false }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [caption, setCaption] = useState('');
    const [uploadArtistName, setUploadArtistName] = useState('');
    const [uploadArtistUrl, setUploadArtistUrl] = useState('');
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [editingCredit, setEditingCredit] = useState(false);
    const [editArtistName, setEditArtistName] = useState('');
    const [editArtistUrl, setEditArtistUrl] = useState('');
    const [savingCredit, setSavingCredit] = useState(false);
    const [creditError, setCreditError] = useState(null);

    // Replacing someone else's poster still requires full admin (matches the
    // server's upload route), but deleting one is also open to editors —
    // both help moderate a show's media alongside admins.
    const canUpload = !additional && user && (!poster || poster.user_id === user.id || isAdmin);
    const canDelete = user && poster && (poster.user_id === user.id || isEditorOrAdmin);
    const posterThanks = poster ? thanksRows.filter(t => t.contentType === 'poster' && t.contentId === poster.id) : [];

    const openUploadForm = () => {
        setShowUploadForm(true);
        setUploadArtistName(poster?.poster_artist_name || '');
        setUploadArtistUrl(poster?.poster_artist_url || '');
    };

    const openCreditEditor = () => {
        setEditArtistName(poster.poster_artist_name || '');
        setEditArtistUrl(poster.poster_artist_url || '');
        setCreditError(null);
        setEditingCredit(true);
    };

    const handleSaveCredit = async () => {
        try {
            setSavingCredit(true);
            setCreditError(null);
            await updatePosterDetails(poster.id, { posterArtistName: editArtistName, posterArtistUrl: editArtistUrl });
            setEditingCredit(false);
            await onChanged();
        } catch (err) {
            console.error('Error updating poster credit:', err);
            setCreditError(err.message || 'Failed to update credit');
        } finally {
            setSavingCredit(false);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('File size must be less than 5MB'); return; }
        if (!file.type.startsWith('image/')) { setError('Only image files are allowed'); return; }
        setSelectedFile(file);
        setError(null);
    };

    const handleUpload = async () => {
        if (!selectedFile) { setError('Please select a poster image'); return; }
        try {
            setUploading(true);
            setError(null);
            await uploadPoster(showId, selectedFile, caption, isFoil, false, false, uploadArtistName, uploadArtistUrl);
            setSelectedFile(null);
            setCaption('');
            setShowUploadForm(false);
            await onChanged();
        } catch (err) {
            if (err.requiresConfirmation) {
                const proceed = confirm(
                    `This poster is also used by ${err.sharedWithShowCount} other show${err.sharedWithShowCount === 1 ? '' : 's'} — ` +
                    'replacing it here will replace it everywhere it\'s linked. Continue?'
                );
                if (proceed) {
                    try {
                        await uploadPoster(showId, selectedFile, caption, isFoil, true, false, uploadArtistName, uploadArtistUrl);
                        setSelectedFile(null);
                        setCaption('');
                        setShowUploadForm(false);
                        await onChanged();
                    } catch (retryErr) {
                        console.error('Error uploading poster:', retryErr);
                        setError(retryErr.message || 'Failed to upload poster');
                    }
                }
            } else {
                console.error('Error uploading poster:', err);
                setError(err.message || 'Failed to upload poster');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete this ${label.toLowerCase()}?`)) return;
        try {
            await deletePoster(poster.id);
            await onChanged();
        } catch (err) {
            console.error('Error deleting poster:', err);
            setError('Failed to delete poster');
        }
    };

    return (
        <div className="space-y-3">
            <PText size="xs" weight="semi-bold" className="uppercase tracking-wide" style={{ color: isFoil ? '#c084fc' : 'var(--p-color-contrast-medium)' }}>
                {label}
            </PText>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            {canUpload && !showUploadForm && (
                <button
                    className={btnSecondary}
                    style={{ color: 'var(--p-color-contrast-medium)' }}
                    onClick={openUploadForm}
                >
                    {poster ? `Replace ${label}` : `Upload ${label}`}
                </button>
            )}

            {showUploadForm && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <PHeading size="sm" tag="h3">{poster ? `Replace ${label}` : `Upload ${label}`}</PHeading>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Poster Image (max 5MB)
                        </label>
                        <input type="file" accept="image/*" onChange={handleFileSelect}
                            className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer" />
                        {selectedFile && (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-1">{selectedFile.name}</PText>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Caption (optional)
                        </label>
                        <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)}
                            placeholder="Add a caption…" className={inputClass} />
                    </div>
                    {isEditorOrAdmin && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    Poster Artist (optional)
                                </label>
                                <input type="text" value={uploadArtistName} onChange={(e) => setUploadArtistName(e.target.value)}
                                    placeholder="e.g., Jane Doe" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    Poster Artist Link (optional)
                                </label>
                                <input type="url" value={uploadArtistUrl} onChange={(e) => setUploadArtistUrl(e.target.value)}
                                    placeholder="https://example.com" className={inputClass} />
                            </div>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button className={btnPrimary} disabled={uploading || !selectedFile} onClick={handleUpload}>
                            {uploading && <Spinner />}
                            {uploading ? 'Uploading…' : 'Upload'}
                        </button>
                        <button
                            className={btnSecondary}
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                            disabled={uploading}
                            onClick={() => { setShowUploadForm(false); setSelectedFile(null); setCaption(''); setUploadArtistName(''); setUploadArtistUrl(''); setError(null); }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {poster ? (
                <div className="space-y-3">
                    <div className="relative group cursor-pointer" onClick={onImageClick}>
                        <img src={poster.poster_url} alt={poster.caption || label}
                            className="w-full max-w-md mx-auto rounded-xl shadow-lg hover:opacity-90 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-xl pointer-events-none">
                            <PText>Click to view full size</PText>
                        </div>
                    </div>

                    {poster.caption && <PText size="sm" color="contrast-medium" align="center">{poster.caption}</PText>}

                    {poster.poster_artist_name && (
                        <PText size="xs" align="center" style={{ color: 'var(--p-color-contrast-low)' }}>
                            Poster art by{' '}
                            {poster.poster_artist_url ? (
                                <a href={poster.poster_artist_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-amber-400 hover:underline">
                                    {poster.poster_artist_name}
                                </a>
                            ) : (
                                <span className="font-semibold" style={{ color: 'var(--p-color-contrast-medium)' }}>{poster.poster_artist_name}</span>
                            )}
                        </PText>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <div className="space-y-1">
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                Uploaded by {poster.profiles?.username
                                    ? <Link to={`/profile/${poster.profiles.username}`} className="hover:underline">{poster.profiles.display_name || poster.profiles.username}</Link>
                                    : 'Unknown'}
                            </PText>
                            <ThanksButton
                                contentType="poster"
                                contentId={poster.id}
                                count={posterThanks.length}
                                thankedByMe={!!user && posterThanks.some(t => t.thankedBy === user.id)}
                                thankedByNames={posterThanks.map(t => t.thankedByName)}
                                isOwnContent={!!user && poster.user_id === user.id}
                                onToggled={onThanksChanged}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {isEditorOrAdmin && !editingCredit && (
                                <PButtonPure size="x-small" icon="edit" onClick={openCreditEditor}>Edit credit</PButtonPure>
                            )}
                            {canDelete && (
                                <PButtonPure size="x-small" icon="delete" onClick={handleDelete}>Delete</PButtonPure>
                            )}
                        </div>
                    </div>

                    {editingCredit && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                            {creditError && <PInlineNotification heading="Error" description={creditError} state="error" dismissButton={false} />}
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    Poster Artist
                                </label>
                                <input type="text" value={editArtistName} onChange={(e) => setEditArtistName(e.target.value)}
                                    placeholder="e.g., Jane Doe" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    Poster Artist Link
                                </label>
                                <input type="url" value={editArtistUrl} onChange={(e) => setEditArtistUrl(e.target.value)}
                                    placeholder="https://example.com" className={inputClass} />
                            </div>
                            <div className="flex gap-2">
                                <button className={btnPrimary} disabled={savingCredit} onClick={handleSaveCredit}>
                                    {savingCredit ? 'Saving…' : 'Save'}
                                </button>
                                <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={savingCredit} onClick={() => setEditingCredit(false)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {isEditorOrAdmin && <PosterLinkManager poster={poster} showDate={showDate} />}
                </div>
            ) : (
                <div className="text-center py-8 space-y-2">
                    <PText color="contrast-medium">No {label.toLowerCase()} uploaded yet</PText>
                </div>
            )}
        </div>
    );
}

// Rare-case trigger for a show's 3rd+ poster — any number of these can exist
// alongside the two primary (regular/foil) slots, unconstrained.
function AddAdditionalPosterForm({ showId, onChanged, isEditorOrAdmin }) {
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [caption, setCaption] = useState('');
    const [isFoil, setIsFoil] = useState(false);
    const [artistName, setArtistName] = useState('');
    const [artistUrl, setArtistUrl] = useState('');

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('File size must be less than 5MB'); return; }
        if (!file.type.startsWith('image/')) { setError('Only image files are allowed'); return; }
        setSelectedFile(file);
        setError(null);
    };

    const reset = () => {
        setOpen(false);
        setSelectedFile(null);
        setCaption('');
        setIsFoil(false);
        setArtistName('');
        setArtistUrl('');
        setError(null);
    };

    const handleUpload = async () => {
        if (!selectedFile) { setError('Please select a poster image'); return; }
        try {
            setUploading(true);
            setError(null);
            await uploadPoster(showId, selectedFile, caption, isFoil, false, true, artistName, artistUrl);
            reset();
            await onChanged();
        } catch (err) {
            console.error('Error uploading additional poster:', err);
            setError(err.message || 'Failed to upload poster');
        } finally {
            setUploading(false);
        }
    };

    if (!open) {
        return (
            <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} onClick={() => setOpen(true)}>
                + Add Additional Poster
            </button>
        );
    }

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <PHeading size="sm" tag="h3">Add Additional Poster</PHeading>
            {error && <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />}
            <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    Poster Image (max 5MB)
                </label>
                <input type="file" accept="image/*" onChange={handleFileSelect}
                    className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer" />
                {selectedFile && (
                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-1">{selectedFile.name}</PText>
                )}
            </div>
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>
                <input type="checkbox" checked={isFoil} onChange={(e) => setIsFoil(e.target.checked)} />
                This is a foil variant
            </label>
            <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    Caption (optional)
                </label>
                <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption…" className={inputClass} />
            </div>
            {isEditorOrAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Poster Artist (optional)
                        </label>
                        <input type="text" value={artistName} onChange={(e) => setArtistName(e.target.value)}
                            placeholder="e.g., Jane Doe" className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Poster Artist Link (optional)
                        </label>
                        <input type="url" value={artistUrl} onChange={(e) => setArtistUrl(e.target.value)}
                            placeholder="https://example.com" className={inputClass} />
                    </div>
                </div>
            )}
            <div className="flex gap-2">
                <button className={btnPrimary} disabled={uploading || !selectedFile} onClick={handleUpload}>
                    {uploading && <Spinner />}
                    {uploading ? 'Uploading…' : 'Upload'}
                </button>
                <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={uploading} onClick={reset}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

export default function PostersSection({ showId, showDate, thanksRows = [], onThanksChanged }) {
    const { user, isAdmin, isEditorOrAdmin } = useAuth();
    const [posters, setPosters] = useState([]);
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const [error, setError] = useState(null);

    const loadPosters = useCallback(async () => {
        try {
            const { posters: showPosters } = await getShowPoster(showId);
            setPosters(showPosters || []);
        } catch (err) {
            console.error('Error loading posters:', err);
            setError('Failed to load posters');
        }
    }, [showId]);

    useEffect(() => { loadPosters(); }, [loadPosters]);

    const regularPoster = posters.find(p => !p.is_foil && p.is_primary) || null;
    const foilPoster = posters.find(p => p.is_foil && p.is_primary) || null;
    const additionalPosters = posters.filter(p => !p.is_primary);
    const slides = posters.map(p => ({ src: p.poster_url, alt: p.caption || 'Show poster', title: p.caption }));

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <PHeading size="lg" tag="h2">Show Posters</PHeading>
            </div>
            <PDivider />

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PosterSlot
                    label="Regular Poster"
                    poster={regularPoster}
                    isFoil={false}
                    showId={showId}
                    showDate={showDate}
                    user={user}
                    isAdmin={isAdmin}
                    isEditorOrAdmin={isEditorOrAdmin}
                    onImageClick={() => setLightboxIndex(posters.indexOf(regularPoster))}
                    onChanged={loadPosters}
                    thanksRows={thanksRows}
                    onThanksChanged={onThanksChanged}
                />
                <PosterSlot
                    label="Foil Poster"
                    poster={foilPoster}
                    isFoil={true}
                    showId={showId}
                    showDate={showDate}
                    user={user}
                    isAdmin={isAdmin}
                    isEditorOrAdmin={isEditorOrAdmin}
                    onImageClick={() => setLightboxIndex(posters.indexOf(foilPoster))}
                    onChanged={loadPosters}
                    thanksRows={thanksRows}
                    onThanksChanged={onThanksChanged}
                />
            </div>

            {additionalPosters.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-white/5">
                    <PText size="xs" weight="semi-bold" className="uppercase tracking-wide" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Additional Posters
                    </PText>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {additionalPosters.map((poster) => (
                            <PosterSlot
                                key={poster.id}
                                label={poster.is_foil ? 'Additional Poster (Foil)' : 'Additional Poster'}
                                poster={poster}
                                isFoil={poster.is_foil}
                                additional
                                showId={showId}
                                showDate={showDate}
                                user={user}
                                isAdmin={isAdmin}
                                isEditorOrAdmin={isEditorOrAdmin}
                                onImageClick={() => setLightboxIndex(posters.indexOf(poster))}
                                onChanged={loadPosters}
                                thanksRows={thanksRows}
                                onThanksChanged={onThanksChanged}
                            />
                        ))}
                    </div>
                </div>
            )}

            {user && (
                <div className="pt-2">
                    <AddAdditionalPosterForm showId={showId} onChanged={loadPosters} isEditorOrAdmin={isEditorOrAdmin} />
                </div>
            )}

            <Lightbox open={lightboxIndex >= 0} close={() => setLightboxIndex(-1)} slides={slides} index={Math.max(lightboxIndex, 0)} />
        </div>
    );
}
