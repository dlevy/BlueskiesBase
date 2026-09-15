import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { fetchTourList } from '../../utils/tourSongCounts';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ToursList() {
    const navigate = useNavigate();
    const [tours, setTours] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [newTourName, setNewTourName] = useState('');
    const [newTourError, setNewTourError] = useState('');

    useEffect(() => {
        fetchTourList({ minShows: 0 })
            .then(setTours)
            .catch(err => {
                console.error('[ToursList] Error fetching tours:', err);
                setError('Failed to load tours');
            })
            .finally(() => setLoading(false));
    }, []);

    const handleCreateTour = (e) => {
        e.preventDefault();
        const name = newTourName.trim();
        if (!name) { setNewTourError('Tour name is required'); return; }
        if (tours.some(t => t.tourName.toLowerCase() === name.toLowerCase())) {
            setNewTourError('A tour with this name already exists');
            return;
        }
        navigate(`/admin/tours/${encodeURIComponent(name)}`);
    };

    if (loading) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PHeading size="2xl" tag="h1">Manage Tours</PHeading>
                {!showNewForm && (
                    <PButton onClick={() => { setShowNewForm(true); setNewTourName(''); setNewTourError(''); }}>
                        + New Tour
                    </PButton>
                )}
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            {showNewForm && (
                <form onSubmit={handleCreateTour} className="rounded-2xl border border-white/10 p-5 space-y-3" style={{ background: 'var(--p-color-surface)' }}>
                    {newTourError && (
                        <PInlineNotification heading="Error" description={newTourError} state="error" dismissButton={false} />
                    )}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Tour Name
                        </label>
                        <input type="text" value={newTourName} autoFocus
                            onChange={(e) => setNewTourName(e.target.value)}
                            placeholder="e.g. Mutiny for the Masses" className={inputClass} />
                    </div>
                    <div className="flex gap-2">
                        <PButton type="submit" size="small">Create</PButton>
                        <PButton type="button" variant="secondary" size="small" onClick={() => setShowNewForm(false)}>
                            Cancel
                        </PButton>
                    </div>
                </form>
            )}

            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'var(--p-color-surface)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-white/10" style={{ background: 'var(--p-color-canvas)' }}>
                            <tr>
                                {['Tour', 'Shows', 'Date Range', 'Actions'].map((h, i) => (
                                    <th key={h}
                                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 3 ? 'text-right' : 'text-left'}`}
                                        style={{ color: 'var(--p-color-contrast-medium)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {tours.map((t) => (
                                <tr key={t.tourName} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3">
                                        <PText size="small" weight="semi-bold">{t.tourName}</PText>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <PText size="small" color="contrast-medium">{t.showCount}</PText>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <PText size="small" color="contrast-medium">
                                            {formatDate(t.firstDate)}
                                            {t.lastDate !== t.firstDate && <> &rarr; {formatDate(t.lastDate)}</>}
                                        </PText>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                        <Link to={`/admin/tours/${encodeURIComponent(t.tourName)}`}>
                                            <PButtonPure size="x-small">Edit</PButtonPure>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {tours.length === 0 && (
                        <div className="text-center py-8">
                            <PText color="contrast-medium">No tours yet. Create one to get started!</PText>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
