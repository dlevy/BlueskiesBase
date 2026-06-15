import { useState, useEffect, useCallback } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PDivider } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import { getShowPoster, uploadPoster, deletePoster } from '../services/api';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

export default function PostersSection({ showId }) {
    const { user, isAdmin } = useAuth();
    const [poster, setPoster] = useState(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [caption, setCaption] = useState('');
    const [showUploadForm, setShowUploadForm] = useState(false);

    const loadPoster = useCallback(async () => {
        try {
            const { poster: showPoster } = await getShowPoster(showId);
            setPoster(showPoster);
        } catch (err) {
            console.error('Error loading poster:', err);
            setError('Failed to load poster');
        }
    }, [showId]);

    useEffect(() => { loadPoster(); }, [loadPoster]);

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
            await uploadPoster(showId, selectedFile, caption);
            setSelectedFile(null);
            setCaption('');
            setShowUploadForm(false);
            await loadPoster();
        } catch (err) {
            console.error('Error uploading poster:', err);
            setError(err.message || 'Failed to upload poster');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this poster?')) return;
        try {
            await deletePoster(poster.id);
            await loadPoster();
        } catch (err) {
            console.error('Error deleting poster:', err);
            setError('Failed to delete poster');
        }
    };

    const canUpload = user && (!poster || poster.user_id === user.id || isAdmin);
    const canDelete = user && poster && (poster.user_id === user.id || isAdmin);

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
            <div className="flex items-center justify-between">
                <PHeading size="lg" tag="h2">Show Poster</PHeading>
                {canUpload && !showUploadForm && (
                    <PButton variant="secondary" size="small" onClick={() => setShowUploadForm(true)}>
                        {poster ? 'Replace Poster' : 'Upload Poster'}
                    </PButton>
                )}
            </div>
            <PDivider />

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            {/* Upload Form */}
            {showUploadForm && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <PHeading size="sm" tag="h3">{poster ? 'Replace Poster' : 'Upload Poster'}</PHeading>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Poster Image (max 5MB)
                        </label>
                        <input type="file" accept="image/*" onChange={handleFileSelect}
                            className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer" />
                        {selectedFile && (
                            <PText size="xs" color="contrast-low" className="mt-1">{selectedFile.name}</PText>
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
                        <PButton size="small" loading={uploading} disabled={!selectedFile} onClick={handleUpload}>
                            Upload
                        </PButton>
                        <PButton variant="secondary" size="small"
                            onClick={() => { setShowUploadForm(false); setSelectedFile(null); setCaption(''); setError(null); }}>
                            Cancel
                        </PButton>
                    </div>
                </div>
            )}

            {/* Poster Display */}
            {poster ? (
                <div className="space-y-3">
                    <div className="relative group cursor-pointer" onClick={() => setLightboxOpen(true)}>
                        <img src={poster.poster_url} alt={poster.caption || 'Show poster'}
                            className="w-full max-w-md mx-auto rounded-xl shadow-lg hover:opacity-90 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-xl pointer-events-none">
                            <PText>Click to view full size</PText>
                        </div>
                    </div>

                    {poster.caption && <PText size="sm" color="contrast-medium" align="center">{poster.caption}</PText>}

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <PText size="xs" color="contrast-low">
                            Uploaded by {poster.profiles?.username || 'Unknown'}
                        </PText>
                        {canDelete && (
                            <PButtonPure size="x-small" icon="delete" onClick={handleDelete}>Delete</PButtonPure>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 space-y-2">
                    <PText color="contrast-medium">No poster uploaded yet</PText>
                    {user && <PText size="xs" color="contrast-low">Be the first to upload a poster for this show!</PText>}
                </div>
            )}

            <Lightbox open={lightboxOpen} close={() => setLightboxOpen(false)}
                slides={poster ? [{ src: poster.poster_url, alt: poster.caption || 'Show poster', title: poster.caption }] : []}
                index={0} />
        </div>
    );
}
