import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getShows, deleteShow } from '../../services/api';
import { buildShowPath } from '../../utils/showSlug';

export default function ShowsList() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [shows, setShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState(null);

    const page = parseInt(searchParams.get('page') || '1', 10);

    const fetchShows = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getShows(page, 20);
            setShows(data.shows || []);
            setPagination(data.pagination);
        } catch (err) {
            console.error('[ShowsList] Error fetching shows:', err);
            setError('Failed to load shows');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchShows();
    }, [fetchShows]);

    const handleDelete = async (id, showDate, artistName) => {
        if (!confirm(`Are you sure you want to delete the show on ${showDate} by ${artistName}?`)) return;
        try {
            await deleteShow(id);
            fetchShows();
        } catch (err) {
            console.error('Error deleting show:', err);
            alert('Failed to delete show');
        }
    };

    const formatDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (loading && shows.length === 0) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PHeading size="2xl" tag="h1">Manage Shows</PHeading>
                <Link to="/admin/shows/new">
                    <PButton>+ Add New Show</PButton>
                </Link>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'var(--p-color-surface)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-white/10" style={{ background: 'var(--p-color-canvas)' }}>
                            <tr>
                                {['Date', 'Artist', 'Venue', 'Tour', 'Actions'].map((h, i) => (
                                    <th key={h}
                                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}
                                        style={{ color: 'var(--p-color-contrast-medium)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {shows.map((show) => (
                                <tr key={show.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <PText size="small">{formatDate(show.show_date)}</PText>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <PText size="small" weight="semi-bold">{show.artist_name}</PText>
                                    </td>
                                    <td className="px-4 py-3">
                                        {show.venues ? (
                                            <div>
                                                <PText size="small">{show.venues.name}</PText>
                                                <PText size="x-small" color="contrast-medium">
                                                    {show.venues.city}, {show.venues.state_country}
                                                </PText>
                                            </div>
                                        ) : (
                                            <PText size="small" color="contrast-medium">No venue</PText>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <PText size="small" color="contrast-medium">{show.tour_name || '-'}</PText>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <Link to={buildShowPath(show)} target="_blank">
                                                <PButtonPure size="x-small">View</PButtonPure>
                                            </Link>
                                            <Link to={`/admin/shows/edit/${show.id}`}>
                                                <PButtonPure size="x-small">Edit</PButtonPure>
                                            </Link>
                                            <PButtonPure size="x-small"
                                                onClick={() => handleDelete(show.id, formatDate(show.show_date), show.artist_name)}
                                                style={{ color: 'var(--p-color-error)' }}>
                                                Delete
                                            </PButtonPure>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {shows.length === 0 && !loading && (
                        <div className="text-center py-8">
                            <PText color="contrast-medium">No shows found. Add your first show!</PText>
                        </div>
                    )}
                </div>
            </div>

            {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-4">
                    <PButton variant="secondary" size="small"
                        disabled={page === 1}
                        onClick={() => setSearchParams({ page: (page - 1).toString() })}>
                        Previous
                    </PButton>
                    <PText size="small" color="contrast-medium">
                        Page {page} of {pagination.totalPages}
                    </PText>
                    <PButton variant="secondary" size="small"
                        disabled={page === pagination.totalPages}
                        onClick={() => setSearchParams({ page: (page + 1).toString() })}>
                        Next
                    </PButton>
                </div>
            )}
        </div>
    );
}
