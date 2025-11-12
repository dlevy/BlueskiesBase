import { useState, useEffect } from 'react';
import { createAlbum, updateAlbum, deleteAlbum } from '../../services/api';

export default function AlbumForm({ album, onClose }) {
    const [formData, setFormData] = useState({
        title: '',
        artist_name: 'Johnny Blue Skies',
        release_date: '',
        album_art_url: '',
        album_type: 'studio',
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (album) {
            setFormData({
                title: album.title || '',
                artist_name: album.artist_name || 'Johnny Blue Skies',
                release_date: album.release_date ? album.release_date.split('T')[0] : '',
                album_art_url: album.album_art_url || '',
                album_type: album.album_type || 'studio',
                notes: album.notes || ''
            });
        }
    }, [album]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (album) {
                await updateAlbum(album.id, formData);
            } else {
                await createAlbum(formData);
            }
            onClose();
        } catch (err) {
            console.error('Error saving album:', err);
            setError(err.message || 'Failed to save album');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        setError(null);

        try {
            await deleteAlbum(album.id);
            onClose();
        } catch (err) {
            console.error('Error deleting album:', err);
            setError(err.message || 'Failed to delete album');
            setShowDeleteConfirm(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">
                    {album ? 'Edit Album' : 'Add New Album'}
                </h1>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    ✕ Close
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-900/20 border border-red-700 text-red-400 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Album Title <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="e.g., Passage Du Desir"
                    />
                </div>

                {/* Artist Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Artist Name <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        name="artist_name"
                        value={formData.artist_name}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="e.g., Johnny Blue Skies, Sturgill Simpson"
                    />
                </div>

                {/* Release Date */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Release Date
                    </label>
                    <input
                        type="date"
                        name="release_date"
                        value={formData.release_date}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                </div>

                {/* Album Type */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Album Type <span className="text-red-400">*</span>
                    </label>
                    <select
                        name="album_type"
                        value={formData.album_type}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="studio">Studio</option>
                        <option value="live">Live</option>
                        <option value="compilation">Compilation</option>
                        <option value="ep">EP</option>
                        <option value="single">Single</option>
                    </select>
                </div>

                {/* Album Art URL */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Album Art URL
                    </label>
                    <input
                        type="url"
                        name="album_art_url"
                        value={formData.album_art_url}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="https://example.com/album-cover.jpg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Optional: URL to album artwork image
                    </p>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Notes
                    </label>
                    <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        rows={3}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="Additional notes about this album..."
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        {loading ? 'Saving...' : (album ? 'Update Album' : 'Create Album')}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </form>

            {/* Delete Section */}
            {album && (
                <div className="bg-gray-800 border border-red-700 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
                    <p className="text-gray-400 text-sm mb-4">
                        Deleting this album will remove it from all associated songs. Songs will not be deleted, but their album association will be removed.
                    </p>
                    
                    {!showDeleteConfirm ? (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={loading}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                            Delete Album
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-red-400 font-medium">
                                Are you sure? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleDelete}
                                    disabled={loading}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    {loading ? 'Deleting...' : 'Yes, Delete Album'}
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={loading}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

