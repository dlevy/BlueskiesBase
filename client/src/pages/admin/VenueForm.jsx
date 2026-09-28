import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification } from '@porsche-design-system/components-react';
import { createVenue, updateVenue, deleteVenue } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";
const labelClass = "block text-xs font-medium mb-1.5";

export default function VenueForm({ venue, onClose }) {
    const { isAdmin } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        city: '',
        state_country: '',
        address: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (venue) {
            setFormData({
                name: venue.name || '',
                city: venue.city || '',
                state_country: venue.state_country || '',
                address: venue.address || '',
            });
        }
    }, [venue]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (venue) {
                await updateVenue(venue.id, formData);
            } else {
                await createVenue(formData);
            }
            onClose();
        } catch (err) {
            console.error('Error saving venue:', err);
            setError(err.message || 'Failed to save venue');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        setError(null);
        try {
            await deleteVenue(venue.id);
            onClose();
        } catch (err) {
            console.error('Error deleting venue:', err);
            setError(err.message || 'Failed to delete venue');
            setShowDeleteConfirm(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PHeading size="2xl" tag="h1">{venue ? 'Edit Venue' : 'Add New Venue'}</PHeading>
                <PButtonPure icon="close" onClick={onClose}>Close</PButtonPure>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Venue Name <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange}
                        required placeholder="e.g., Red Rocks Amphitheatre" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        City <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <input type="text" name="city" value={formData.city} onChange={handleChange}
                        required placeholder="e.g., Morrison" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        State/Country <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <input type="text" name="state_country" value={formData.state_country} onChange={handleChange}
                        required placeholder="e.g., CO or United States" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Address</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange}
                        placeholder="e.g., 18300 W Alameda Pkwy" className={inputClass} />
                    <PText size="x-small" color="contrast-medium">Optional</PText>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/10">
                    <PButton type="submit" loading={loading}>
                        {venue ? 'Update Venue' : 'Create Venue'}
                    </PButton>
                    <PButton type="button" variant="secondary" disabled={loading} onClick={onClose}>
                        Cancel
                    </PButton>
                </div>
            </form>

            {venue && isAdmin && (
                <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--p-color-error)' }}>
                    <PHeading size="lg" tag="h2" style={{ color: 'var(--p-color-error)' }}>Danger Zone</PHeading>
                    <PText size="small" color="contrast-medium">
                        Deleting this venue is only possible if no shows still reference it.
                    </PText>

                    {!showDeleteConfirm ? (
                        <PButton variant="secondary" disabled={loading}
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{ '--p-button-secondary-color': 'var(--p-color-error)', '--p-button-secondary-border-color': 'var(--p-color-error)' }}>
                            Delete Venue
                        </PButton>
                    ) : (
                        <div className="space-y-3">
                            <PText weight="semi-bold" style={{ color: 'var(--p-color-error)' }}>
                                Are you sure? This action cannot be undone.
                            </PText>
                            <div className="flex gap-3">
                                <PButton loading={loading} onClick={handleDelete}
                                    style={{ '--p-button-primary-bg': 'var(--p-color-error)' }}>
                                    {loading ? 'Deleting...' : 'Yes, Delete Venue'}
                                </PButton>
                                <PButton variant="secondary" disabled={loading}
                                    onClick={() => setShowDeleteConfirm(false)}>
                                    Cancel
                                </PButton>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
