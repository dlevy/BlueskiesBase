import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getVenues } from '../../services/api';
import VenueForm from './VenueForm';

export default function VenuesList() {
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingVenue, setEditingVenue] = useState(null);

    useEffect(() => { fetchVenues(); }, []);

    const fetchVenues = async () => {
        try {
            setLoading(true);
            const data = await getVenues();
            setVenues(data.venues || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching venues:', err);
            setError('Failed to load venues');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (venue) => { setEditingVenue(venue); setShowForm(true); };
    const handleNew = () => { setEditingVenue(null); setShowForm(true); };
    const handleFormClose = () => { setShowForm(false); setEditingVenue(null); fetchVenues(); };

    if (loading) return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    if (error) return <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />;
    if (showForm) return <VenueForm venue={editingVenue} onClose={handleFormClose} />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <PHeading size="2xl" tag="h1">Venues</PHeading>
                    <PText size="small" color="contrast-medium">
                        Manage concert venues
                    </PText>
                </div>
                <PButton onClick={handleNew}>+ Add Venue</PButton>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-4">
                <div className="text-3xl font-bold" style={{ color: 'var(--p-color-info)' }}>{venues.length}</div>
                <PText size="small" color="contrast-medium">Total Venues</PText>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'var(--p-color-surface)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-white/10" style={{ background: 'var(--p-color-canvas)' }}>
                            <tr>
                                {['Name', 'City', 'State/Country', 'Actions'].map((h, i) => (
                                    <th key={h}
                                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 3 ? 'text-right' : 'text-left'}`}
                                        style={{ color: 'var(--p-color-contrast-medium)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {venues.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center">
                                        <PText color="contrast-medium">No venues found. Click "Add Venue" to create one.</PText>
                                    </td>
                                </tr>
                            ) : (
                                venues.map((venue) => (
                                    <tr key={venue.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3">
                                            <PText size="small" weight="semi-bold">{venue.name}</PText>
                                            {venue.address && (
                                                <PText size="x-small" color="contrast-medium">{venue.address}</PText>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <PText size="small" color="contrast-medium">{venue.city}</PText>
                                        </td>
                                        <td className="px-4 py-3">
                                            <PText size="small" color="contrast-medium">{venue.state_country}</PText>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <PButtonPure size="x-small" onClick={() => handleEdit(venue)}>Edit</PButtonPure>
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
