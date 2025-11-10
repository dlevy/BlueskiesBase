import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getShows, deleteShow } from '../../services/api';

export default function ShowsList() {
    const [shows, setShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);

    useEffect(() => {
        fetchShows();
    }, [page]);

    const fetchShows = async () => {
        try {
            setLoading(true);
            const data = await getShows(page, 20);
            setShows(data.shows || []);
            setPagination(data.pagination);
        } catch (err) {
            console.error('Error fetching shows:', err);
            setError('Failed to load shows');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, showDate, artistName) => {
        if (!confirm(`Are you sure you want to delete the show on ${showDate} by ${artistName}?`)) {
            return;
        }

        try {
            await deleteShow(id);
            fetchShows(); // Refresh the list
        } catch (err) {
            console.error('Error deleting show:', err);
            alert('Failed to delete show');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading && shows.length === 0) {
        return <div className="text-center py-8 text-gray-300">Loading...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Manage Shows</h1>
                <Link
                    to="/admin/shows/new"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                    + Add New Show
                </Link>
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            <div className="bg-gray-800 shadow-2xl rounded-lg overflow-hidden border border-gray-700">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-900">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Date
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Artist
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Venue
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Tour
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {shows.map((show) => (
                            <tr key={show.id} className="hover:bg-gray-750 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                                    {formatDate(show.show_date)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">
                                    {show.artist_name}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-200">
                                    {show.venues ? (
                                        <>
                                            {show.venues.name}
                                            <br />
                                            <span className="text-gray-400">
                                                {show.venues.city}, {show.venues.state_country}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-gray-500">No venue</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-400">
                                    {show.tour_name || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link
                                        to={`/show/${show.id}`}
                                        className="text-blue-400 hover:text-blue-300 mr-4 transition-colors"
                                        target="_blank"
                                    >
                                        View
                                    </Link>
                                    <Link
                                        to={`/admin/shows/edit/${show.id}`}
                                        className="text-indigo-400 hover:text-indigo-300 mr-4 transition-colors"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(show.id, formatDate(show.show_date), show.artist_name)}
                                        className="text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {shows.length === 0 && !loading && (
                    <div className="text-center py-8 text-gray-400">
                        No shows found. Add your first show!
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex justify-center gap-2">
                    <button
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 text-gray-300">
                        Page {page} of {pagination.totalPages}
                    </span>
                    <button
                        onClick={() => setPage(page + 1)}
                        disabled={page === pagination.totalPages}
                        className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}

