import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getShowPoster, uploadPoster, updatePosterCaption, deletePoster } from '../services/api';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export default function PostersSection({ showId }) {
    const { user, isAdmin } = useAuth();
    const [poster, setPoster] = useState(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [caption, setCaption] = useState('');
    const [showUploadForm, setShowUploadForm] = useState(false);

    useEffect(() => {
        loadPoster();
    }, [showId]);

    const loadPoster = async () => {
        try {
            const { poster: showPoster } = await getShowPoster(showId);
            setPoster(showPoster);
        } catch (err) {
            console.error('Error loading poster:', err);
            setError('Failed to load poster');
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
            setError('Please select a poster image');
            return;
        }

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
        if (!confirm('Are you sure you want to delete this poster?')) {
            return;
        }

        try {
            await deletePoster(poster.id);
            await loadPoster();
        } catch (err) {
            console.error('Error deleting poster:', err);
            setError('Failed to delete poster');
        }
    };

    const openLightbox = () => {
        setLightboxOpen(true);
    };

    const lightboxSlides = poster ? [{
        src: poster.poster_url,
        alt: poster.caption || 'Show poster',
        title: poster.caption,
    }] : [];

    const canUpload = user && (!poster || poster.user_id === user.id || isAdmin);
    const canDelete = user && poster && (poster.user_id === user.id || isAdmin);

    return (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-purple-400">Show Poster</h2>
                {canUpload && !showUploadForm && (
                    <button
                        onClick={() => setShowUploadForm(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                    >
                        {poster ? 'Replace Poster' : 'Upload Poster'}
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {/* Upload Form */}
            {showUploadForm && (
                <div className="bg-gray-700 rounded-lg p-4 mb-4 border border-gray-600">
                    <h3 className="text-lg font-semibold text-gray-100 mb-3">
                        {poster ? 'Replace Poster' : 'Upload Poster'}
                    </h3>
                    
                    <div className="mb-4">
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Poster Image (max 5MB)
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer"
                        />
                        {selectedFile && (
                            <p className="text-sm text-gray-400 mt-2">
                                Selected: {selectedFile.name}
                            </p>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Caption (optional)
                        </label>
                        <input
                            type="text"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="Add a caption..."
                            className="bg-gray-600 border border-gray-500 rounded w-full py-2 px-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleUpload}
                            disabled={uploading || !selectedFile}
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
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
                            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Poster Display */}
            {poster ? (
                <div className="space-y-4">
                    <div className="relative group">
                        <img
                            src={poster.poster_url}
                            alt={poster.caption || 'Show poster'}
                            className="w-full max-w-md mx-auto rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={openLightbox}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-lg cursor-pointer max-w-md mx-auto">
                            <span className="text-white text-lg font-semibold">Click to view full size</span>
                        </div>
                    </div>

                    {poster.caption && (
                        <p className="text-gray-300 text-center italic">{poster.caption}</p>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-400 border-t border-gray-700 pt-3">
                        <span>
                            Uploaded by <span className="text-purple-400">{poster.profiles?.username || 'Unknown'}</span>
                        </span>
                        {canDelete && (
                            <button
                                onClick={handleDelete}
                                className="text-red-400 hover:text-red-300 font-semibold transition-colors"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-lg mb-2">No poster uploaded yet</p>
                    {user && (
                        <p className="text-sm">Be the first to upload a poster for this show!</p>
                    )}
                </div>
            )}

            {/* Lightbox */}
            <Lightbox
                open={lightboxOpen}
                close={() => setLightboxOpen(false)}
                slides={lightboxSlides}
                index={0}
            />
        </div>
    );
}

