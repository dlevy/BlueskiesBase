import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSongs } from '../../services/api';
import SongForm from './SongForm';

export default function SongsList() {
    const [songs, setSongs] = useState([]);
    const [filteredSongs, setFilteredSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, original, cover
    const [showForm, setShowForm] = useState(false);
    const [editingSong, setEditingSong] = useState(null);
    const [stats, setStats] = useState({ total: 0, original: 0, covers: 0 });

    useEffect(() => {
        fetchSongs();
    }, []);

    useEffect(() => {
        filterSongs();
    }, [songs, searchTerm, filterType]);

    const fetchSongs = async () => {
        try {
            setLoading(true);
            const data = await getSongs();
            setSongs(data.songs || []);
            
            // Calculate stats
            const total = data.songs?.length || 0;
            const original = data.songs?.filter(s => s.is_original).length || 0;
            const covers = total - original;
            setStats({ total, original, covers });
            
            setError(null);
        } catch (err) {
            console.error('Error fetching songs:', err);
            setError('Failed to load songs');
        } finally {
            setLoading(false);
        }
    };

    const filterSongs = () => {
        let filtered = songs;

        // Filter by type
        if (filterType === 'original') {
            filtered = filtered.filter(song => song.is_original);
        } else if (filterType === 'cover') {
            filtered = filtered.filter(song => !song.is_original);
        }

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(song =>
                song.title.toLowerCase().includes(term) ||
                song.original_artist?.toLowerCase().includes(term) ||
                song.written_by?.toLowerCase().includes(term)
            );
        }

        setFilteredSongs(filtered);
    };

    const handleEdit = (song) => {
        setEditingSong(song);
        setShowForm(true);
    };

    const handleNew = () => {
        setEditingSong(null);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingSong(null);
        fetchSongs(); // Refresh the list
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="text-gray-400">Loading songs...</div>
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
        return <SongForm song={editingSong} onClose={handleFormClose} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Manage Songs</h1>
                    <p className="text-gray-400 mt-1">
                        {stats.total} total songs ({stats.original} original, {stats.covers} covers)
                    </p>
                </div>
                <button
                    onClick={handleNew}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                    + Add New Song
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm">Total Songs</div>
                    <div className="text-3xl font-bold text-white mt-1">{stats.total}</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm">Original Songs</div>
                    <div className="text-3xl font-bold text-green-400 mt-1">{stats.original}</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm">Cover Songs</div>
                    <div className="text-3xl font-bold text-blue-400 mt-1">{stats.covers}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Search Songs
                        </label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by title, artist, or writer..."
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Filter Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Filter by Type
                        </label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="all">All Songs</option>
                            <option value="original">Original Songs Only</option>
                            <option value="cover">Cover Songs Only</option>
                        </select>
                    </div>
                </div>

                {/* Results count */}
                <div className="mt-3 text-sm text-gray-400">
                    Showing {filteredSongs.length} of {songs.length} songs
                </div>
            </div>

            {/* Songs Table */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-900 border-b border-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Title
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Original Artist
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Written By
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Shows
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredSongs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                                        No songs found
                                    </td>
                                </tr>
                            ) : (
                                filteredSongs.map((song) => (
                                    <tr key={song.id} className="hover:bg-gray-750 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-white">{song.title}</span>
                                                {song.notes && (
                                                    <span className="text-xs text-gray-500" title={song.notes}>
                                                        📝
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {song.is_original ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-900/50 text-green-300 border border-green-700">
                                                    Original
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700">
                                                    Cover
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">
                                            {song.original_artist || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">
                                            {song.written_by || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {song.performance_count > 0 ? (
                                                <Link
                                                    to={`/?song=${encodeURIComponent(song.title)}`}
                                                    className="text-blue-400 hover:text-blue-300 font-medium text-sm transition-colors hover:underline"
                                                    title={`View ${song.performance_count} show${song.performance_count !== 1 ? 's' : ''} where this song was played`}
                                                >
                                                    {song.performance_count}
                                                </Link>
                                            ) : (
                                                <span className="text-gray-500 text-sm">0</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleEdit(song)}
                                                className="text-blue-400 hover:text-blue-300 font-medium text-sm transition-colors"
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

