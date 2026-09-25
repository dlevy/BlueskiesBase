import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PInlineNotification, PDivider } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import { getShowPoster, uploadPoster, deletePoster } from '../services/api';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

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
// independent of the other variant.
function PosterSlot({ label, poster, isFoil, showId, user, isAdmin, isEditorOrAdmin, onImageClick, onChanged }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [caption, setCaption] = useState('');
    const [showUploadForm, setShowUploadForm] = useState(false);

    // Replacing someone else's poster still requires full admin (matches the
    // server's upload route), but deleting one is also open to editors —
    // both help moderate a show's media alongside admins.
    const canUpload = user && (!poster || poster.user_id === user.id || isAdmin);
    const canDelete = user && poster && (poster.user_id === user.id || isEditorOrAdmin);

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
            await uploadPoster(showId, selectedFile, caption, isFoil);
            setSelectedFile(null);
            setCaption('');
            setShowUploadForm(false);
            await onChanged();
        } catch (err) {
            console.error('Error uploading poster:', err);
            setError(err.message || 'Failed to upload poster');
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
                    onClick={() => setShowUploadForm(true)}
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
                    <div className="flex gap-2">
                        <button className={btnPrimary} disabled={uploading || !selectedFile} onClick={handleUpload}>
                            {uploading && <Spinner />}
                            {uploading ? 'Uploading…' : 'Upload'}
                        </button>
                        <button
                            className={btnSecondary}
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                            disabled={uploading}
                            onClick={() => { setShowUploadForm(false); setSelectedFile(null); setCaption(''); setError(null); }}
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

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                            Uploaded by {poster.profiles?.username
                                ? <Link to={`/profile/${poster.profiles.username}`} className="hover:underline">{poster.profiles.display_name || poster.profiles.username}</Link>
                                : 'Unknown'}
                        </PText>
                        {canDelete && (
                            <PButtonPure size="x-small" icon="delete" onClick={handleDelete}>Delete</PButtonPure>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 space-y-2">
                    <PText color="contrast-medium">No {label.toLowerCase()} uploaded yet</PText>
                </div>
            )}
        </div>
    );
}

export default function PostersSection({ showId }) {
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

    const regularPoster = posters.find(p => !p.is_foil) || null;
    const foilPoster = posters.find(p => p.is_foil) || null;
    const slides = posters.map(p => ({ src: p.poster_url, alt: p.caption || 'Show poster', title: p.caption }));

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
            <PHeading size="lg" tag="h2">Show Posters</PHeading>
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
                    user={user}
                    isAdmin={isAdmin}
                    isEditorOrAdmin={isEditorOrAdmin}
                    onImageClick={() => setLightboxIndex(posters.indexOf(regularPoster))}
                    onChanged={loadPosters}
                />
                <PosterSlot
                    label="Foil Poster"
                    poster={foilPoster}
                    isFoil={true}
                    showId={showId}
                    user={user}
                    isAdmin={isAdmin}
                    isEditorOrAdmin={isEditorOrAdmin}
                    onImageClick={() => setLightboxIndex(posters.indexOf(foilPoster))}
                    onChanged={loadPosters}
                />
            </div>

            <Lightbox open={lightboxIndex >= 0} close={() => setLightboxIndex(-1)} slides={slides} index={Math.max(lightboxIndex, 0)} />
        </div>
    );
}
