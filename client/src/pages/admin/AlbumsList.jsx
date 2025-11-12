import { useState, useEffect } from 'react';
import { getAlbums } from '../../services/api';
import AlbumForm from './AlbumForm';

export default function AlbumsList() {
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingAlbum, setEditingAlbum] = useState(null);

    useEffect(() => {
        fetchAlbums();
    }, []);

    const fetchAlbums = async () => {
        try {
            setLoading(true);
            const data = await getAlbums();
            setAlbums(data.albums || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching albums:', err);
            setError('Failed to load albums');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (album) => {
        setEditingAlbum(album);
        setShowForm(true);
    };

    const handleNew = () => {
        setEditingAlbum(null);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingAlbum(null);
        fetchAlbums(); // Refresh the list
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="text-gray-400">Loading albums...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/20 border border-red-700 text-red-400 px-4 py-3 rounded">
                {error}
            </div>
        );
    }

    if (showForm) {
        return <AlbumForm album={editingAlbum} onClose={handleFormClose} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Albums</h1>
                    <p className="text-gray-400 mt-1">
                        Manage albums for associating with original songs
                    </p>
                </div>
                <button
                    onClick={handleNew}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    + Add Album
                </button>
            </div>

            {/* Stats */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-400">{albums.length}</div>
                <div className="text-sm text-gray-400">Total Albums</div>
            </div>

            {/* Albums List */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-900 border-b border-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Album Title
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Artist
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Release Date
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {albums.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                                        No albums found. Click "Add Album" to create one.
                                    </td>
                                </tr>
                            ) : (
                                albums.map((album) => (
                                    <tr
                                        key={album.id}
                                        className="hover:bg-gray-750 transition-colors"
                                    >
                                        <td className="px-4 py-4">
                                            <div className="text-white font-medium">{album.title}</div>
                                            {album.notes && (
                                                <div className="text-xs text-gray-500 mt-1">{album.notes}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-gray-300">
                                            {album.artist_name}
                                        </td>
                                        <td className="px-4 py-4 text-gray-300">
                                            {formatDate(album.release_date)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                album.album_type === 'studio' ? 'bg-blue-900/50 text-blue-300' :
                                                album.album_type === 'live' ? 'bg-purple-900/50 text-purple-300' :
                                                album.album_type === 'compilation' ? 'bg-yellow-900/50 text-yellow-300' :
                                                album.album_type === 'ep' ? 'bg-green-900/50 text-green-300' :
                                                'bg-gray-700 text-gray-300'
                                            }`}>
                                                {album.album_type || 'unknown'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <button
                                                onClick={() => handleEdit(album)}
                                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

