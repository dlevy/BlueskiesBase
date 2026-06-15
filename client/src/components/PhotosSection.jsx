import { useState, useEffect, useCallback } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PDivider } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import { getShowPhotos, uploadPhoto, deletePhoto } from '../services/api';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

export default function PhotosSection({ showId }) {
    const { user, isAdmin } = useAuth();
    const [photos, setPhotos] = useState([]);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [caption, setCaption] = useState('');
    const [showUploadForm, setShowUploadForm] = useState(false);

    const loadPhotos = useCallback(async () => {
        try {
            const { photos: allPhotos } = await getShowPhotos(showId);
            setPhotos(allPhotos || []);
        } catch (err) {
            console.error('Error loading photos:', err);
            setError('Failed to load photos');
        }
    }, [showId]);

    useEffect(() => { loadPhotos(); }, [loadPhotos]);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('File size must be less than 5MB'); return; }
        if (!file.type.startsWith('image/')) { setError('Only image files are allowed'); return; }
        setSelectedFile(file);
        setError(null);
    };

    const handleUpload = async () => {
        if (!selectedFile) { setError('Please select a photo'); return; }
        try {
            setUploading(true);
            setError(null);
            await uploadPhoto(showId, selectedFile, caption);
            setSelectedFile(null);
            setCaption('');
            setShowUploadForm(false);
            await loadPhotos();
        } catch (err) {
            console.error('Error uploading photo:', err);
            setError(err.message || 'Failed to upload photo');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (photoId) => {
        if (!confirm('Are you sure you want to delete this photo?')) return;
        try {
            await deletePhoto(photoId);
            await loadPhotos();
        } catch (err) {
            console.error('Error deleting photo:', err);
            setError('Failed to delete photo');
        }
    };

    const lightboxSlides = photos.map(p => ({ src: p.photo_url, alt: p.caption || 'Show photo', title: p.caption }));

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
            <div className="flex items-center justify-between">
                <PHeading size="lg" tag="h2">Photos</PHeading>
                {user && !showUploadForm && (
                    <PButton variant="secondary" size="small" onClick={() => setShowUploadForm(true)}>
                        Upload Photo
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
                    <PHeading size="sm" tag="h3">Upload Photo</PHeading>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Select Photo (max 5MB)
                        </label>
                        <input type="file" accept="image/*" onChange={handleFileSelect}
                            className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer" />
                        {selectedFile && (
                            <PText size="xs" color="contrast-low" className="mt-1">
                                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                            </PText>
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
                        <PButton variant="secondary" size="small" disabled={uploading}
                            onClick={() => { setShowUploadForm(false); setSelectedFile(null); setCaption(''); setError(null); }}>
                            Cancel
                        </PButton>
                    </div>
                </div>
            )}

            {/* Photo Display */}
            {photos.length > 0 ? (
                <div className="space-y-3">
                    <div className="relative cursor-pointer group" onClick={() => setLightboxOpen(true)}>
                        <img src={photos[currentPhotoIndex].photo_url}
                            alt={photos[currentPhotoIndex].caption || 'Show photo'}
                            className="w-full h-96 object-cover rounded-xl" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded-xl flex items-center justify-center">
                            <PText className="opacity-0 group-hover:opacity-100 transition-opacity text-white">
                                Click to view full size
                            </PText>
                        </div>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                        <div>
                            {photos[currentPhotoIndex].caption && (
                                <PText size="sm">{photos[currentPhotoIndex].caption}</PText>
                            )}
                            <PText size="xs" color="contrast-low">
                                By {photos[currentPhotoIndex].profiles?.username || 'Anonymous'} · {new Date(photos[currentPhotoIndex].created_at).toLocaleDateString()}
                            </PText>
                        </div>
                        {(isAdmin || (user && photos[currentPhotoIndex].user_id === user.id)) && (
                            <PButtonPure size="x-small" icon="delete" onClick={() => handleDelete(photos[currentPhotoIndex].id)}>
                                Delete
                            </PButtonPure>
                        )}
                    </div>

                    {photos.length > 1 && (
                        <div>
                            <PText size="xs" color="contrast-low" className="mb-2">
                                Photo {currentPhotoIndex + 1} of {photos.length}
                            </PText>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {photos.map((photo, index) => (
                                    <img key={photo.id} src={photo.photo_url} alt={`Thumbnail ${index + 1}`}
                                        onClick={() => setCurrentPhotoIndex(index)}
                                        className={`w-20 h-20 object-cover rounded-lg cursor-pointer transition-all shrink-0 ${
                                            index === currentPhotoIndex ? 'ring-2 ring-[var(--p-color-primary)]' : 'opacity-60 hover:opacity-100'
                                        }`} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-8 space-y-2">
                    <PText color="contrast-medium">No photos yet</PText>
                    {!user && <PText size="xs" color="contrast-low">Sign in to upload the first photo!</PText>}
                </div>
            )}

            <Lightbox open={lightboxOpen} close={() => setLightboxOpen(false)}
                slides={lightboxSlides} index={currentPhotoIndex}
                on={{ view: ({ index }) => setCurrentPhotoIndex(index) }} />
        </div>
    );
}
