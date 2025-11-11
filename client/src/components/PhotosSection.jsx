import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getShowPhotos, uploadPhoto, updatePhotoCaption, deletePhoto } from '../services/api';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

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

    useEffect(() => {
        loadPhotos();
    }, [showId]);

    const loadPhotos = async () => {
        try {
            const { photos: allPhotos } = await getShowPhotos(showId);
            setPhotos(allPhotos || []);
        } catch (err) {
            console.error('Error loading photos:', err);
            setError('Failed to load photos');
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB');
                return;
            }
            // Check file type
            if (!file.type.startsWith('image/')) {
                setError('Only image files are allowed');
                return;
            }
            setSelectedFile(file);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('Please select a photo');
            return;
        }

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
        if (!confirm('Are you sure you want to delete this photo?')) {
            return;
        }

        try {
            await deletePhoto(photoId);
            await loadPhotos();
        } catch (err) {
            console.error('Error deleting photo:', err);
            setError('Failed to delete photo');
        }
    };

    const openLightbox = (index) => {
        setCurrentPhotoIndex(index);
        setLightboxOpen(true);
    };

    const lightboxSlides = photos.map(photo => ({
        src: photo.photo_url,
        alt: photo.caption || 'Show photo',
        title: photo.caption,
    }));

    return (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-blue-400">Photos</h2>
                {user && !showUploadForm && (
                    <button
                        onClick={() => setShowUploadForm(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
                    >
                        Upload Photo
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {/* Upload Form */}
            {showUploadForm && (
                <div className="mb-6 bg-gray-900 rounded-lg p-4 border border-blue-700">
                    <h3 className="text-lg font-semibold text-blue-300 mb-3">Upload Photo</h3>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="block text-gray-300 mb-2 text-sm">
                                Select Photo (max 5MB)
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                            />
                        </div>

                        {selectedFile && (
                            <div className="text-sm text-gray-400">
                                Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                            </div>
                        )}

                        <div>
                            <label className="block text-gray-300 mb-2 text-sm">
                                Caption (optional)
                            </label>
                            <input
                                type="text"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="Add a caption..."
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleUpload}
                                disabled={uploading || !selectedFile}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
                            >
                                {uploading ? 'Uploading...' : 'Upload'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowUploadForm(false);
                                    setSelectedFile(null);
                                    setCaption('');
                                    setError(null);
                                }}
                                disabled={uploading}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photos Display */}
            {photos.length > 0 ? (
                <div>
                    {/* Current Photo Display */}
                    <div className="mb-4">
                        <div 
                            className="relative cursor-pointer group"
                            onClick={() => openLightbox(currentPhotoIndex)}
                        >
                            <img
                                src={photos[currentPhotoIndex].photo_url}
                                alt={photos[currentPhotoIndex].caption || 'Show photo'}
                                className="w-full h-96 object-cover rounded-lg"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                                <span className="text-white opacity-0 group-hover:opacity-100 text-lg font-semibold">
                                    Click to view full size
                                </span>
                            </div>
                        </div>

                        {/* Photo Info */}
                        <div className="mt-3 flex justify-between items-start">
                            <div>
                                {photos[currentPhotoIndex].caption && (
                                    <p className="text-gray-300 mb-1">{photos[currentPhotoIndex].caption}</p>
                                )}
                                <p className="text-sm text-gray-500">
                                    By {photos[currentPhotoIndex].profiles?.username || 'Anonymous'} • {' '}
                                    {new Date(photos[currentPhotoIndex].created_at).toLocaleDateString()}
                                </p>
                            </div>
                            {(isAdmin || (user && photos[currentPhotoIndex].user_id === user.id)) && (
                                <button
                                    onClick={() => handleDelete(photos[currentPhotoIndex].id)}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Thumbnail Navigation */}
                    {photos.length > 1 && (
                        <div>
                            <p className="text-gray-400 text-sm mb-2">
                                Photo {currentPhotoIndex + 1} of {photos.length}
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {photos.map((photo, index) => (
                                    <img
                                        key={photo.id}
                                        src={photo.photo_url}
                                        alt={`Thumbnail ${index + 1}`}
                                        onClick={() => setCurrentPhotoIndex(index)}
                                        className={`w-20 h-20 object-cover rounded cursor-pointer transition-all ${
                                            index === currentPhotoIndex
                                                ? 'ring-2 ring-blue-500 opacity-100'
                                                : 'opacity-60 hover:opacity-100'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">No photos yet</p>
                    {!user && (
                        <p className="text-gray-500 text-sm">Sign in to upload the first photo!</p>
                    )}
                </div>
            )}

            {/* Lightbox */}
            <Lightbox
                open={lightboxOpen}
                close={() => setLightboxOpen(false)}
                slides={lightboxSlides}
                index={currentPhotoIndex}
                on={{
                    view: ({ index }) => setCurrentPhotoIndex(index),
                }}
            />
        </div>
    );
}

