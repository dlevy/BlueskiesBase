import { useState, useEffect } from 'react';
import { createSong, updateSong, deleteSong, getAlbums } from '../../services/api';

export default function SongForm({ song, onClose }) {
    const [formData, setFormData] = useState({
        title: '',
        is_original: true,
        original_artist: '',
        written_by: '',
        lyrics: '',
        notes: '',
        album_id: ''
    });
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        // Fetch albums for dropdown
        const fetchAlbums = async () => {
            try {
                const data = await getAlbums();
                setAlbums(data.albums || []);
            } catch (err) {
                console.error('Error fetching albums:', err);
            }
        };
        fetchAlbums();
    }, []);

    useEffect(() => {
        if (song) {
            setFormData({
                title: song.title || '',
                is_original: song.is_original ?? true,
                original_artist: song.original_artist || '',
                written_by: song.written_by || '',
                lyrics: song.lyrics || '',
                notes: song.notes || '',
                album_id: song.album_id || ''
            });
        }
    }, [song]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (song) {
                await updateSong(song.id, formData);
            } else {
                await createSong(formData);
            }
            onClose();
        } catch (err) {
            console.error('Error saving song:', err);
            setError(err.message || 'Failed to save song');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        setError(null);

        try {
            await deleteSong(song.id);
            onClose();
        } catch (err) {
            console.error('Error deleting song:', err);
            setError(err.message || 'Failed to delete song. This song may be used in setlists.');
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
                    {song ? 'Edit Song' : 'Add New Song'}
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
                        Song Title <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="Enter song title"
                    />
                </div>

                {/* Is Original Checkbox */}
                <div className="flex items-center gap-3 p-4 bg-gray-900 rounded border border-gray-700">
                    <input
                        type="checkbox"
                        name="is_original"
                        id="is_original"
                        checked={formData.is_original}
                        onChange={handleChange}
                        className="w-4 h-4"
                    />
                    <label htmlFor="is_original" className="text-gray-300 cursor-pointer">
                        This is an original song (not a cover)
                    </label>
                </div>

                {/* Original Artist (shown if not original) */}
                {!formData.is_original && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Original Artist
                        </label>
                        <input
                            type="text"
                            name="original_artist"
                            value={formData.original_artist}
                            onChange={handleChange}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="e.g., The Beatles, Bob Dylan"
                        />
                    </div>
                )}

                {/* Written By */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Written By
                    </label>
                    <input
                        type="text"
                        name="written_by"
                        value={formData.written_by}
                        onChange={handleChange}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="e.g., John Lennon, Paul McCartney"
                    />
                </div>

                {/* Album (shown only for originals) */}
                {formData.is_original && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Album
                        </label>
                        <select
                            name="album_id"
                            value={formData.album_id}
                            onChange={handleChange}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="">-- No Album / Unreleased --</option>
                            {albums.map(album => (
                                <option key={album.id} value={album.id}>
                                    {album.title} ({new Date(album.release_date).getFullYear()}) - {album.album_type}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Select the album this song appears on (leave blank if unreleased)
                        </p>
                    </div>
                )}

                {/* Lyrics */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Lyrics
                    </label>
                    <textarea
                        name="lyrics"
                        value={formData.lyrics}
                        onChange={handleChange}
                        rows="8"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                        placeholder="Enter song lyrics (optional)"
                    />
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
                        rows="3"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="Any additional notes about this song"
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                    <div>
                        {song && (
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="text-red-400 hover:text-red-300 font-medium transition-colors"
                            >
                                Delete Song
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : (song ? 'Update Song' : 'Create Song')}
                        </button>
                    </div>
                </div>
            </form>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">Delete Song?</h3>
                        <p className="text-gray-300 mb-6">
                            Are you sure you want to delete "{song?.title}"? This action cannot be undone.
                        </p>
                        <p className="text-sm text-yellow-400 mb-6">
                            Note: Songs that are used in setlists cannot be deleted.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 border border-gray-600 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

