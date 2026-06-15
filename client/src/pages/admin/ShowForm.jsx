import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getShowById, createShow, updateShow, getVenues, updateSetlist, createVenue } from '../../services/api';
import SetlistEditor from '../../components/SetlistEditor';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";
const selectClass = "w-full rounded-lg border border-white/10 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent";
const labelClass = "block text-xs font-medium mb-1.5";

export default function ShowForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [venues, setVenues] = useState([]);
    const [setlistData, setSetlistData] = useState([]);
    const [initialSetlist, setInitialSetlist] = useState({});
    const [showVenueForm, setShowVenueForm] = useState(false);
    const [venueFormData, setVenueFormData] = useState({ name: '', city: '', state_country: '', address: '' });
    const [venueFormError, setVenueFormError] = useState('');

    const [formData, setFormData] = useState({
        venue_id: '',
        show_date: '',
        artist_name: 'Johnny Blue Skies',
        tour_name: '',
        notes: '',
        has_images: false,
        source_types: []
    });

    const sourceTypeOptions = ['SBD', 'AUD', 'Matrix', 'FM', 'Video'];

    useEffect(() => {
        fetchVenues();
        if (isEdit) fetchShow();
    }, [id]);

    const fetchVenues = async () => {
        try {
            const data = await getVenues();
            setVenues(data.venues || []);
        } catch (err) {
            console.error('Error fetching venues:', err);
        }
    };

    const fetchShow = async () => {
        try {
            setLoading(true);
            const show = await getShowById(id);
            setFormData({
                venue_id: show.venue_id || '',
                show_date: show.show_date || '',
                artist_name: show.artist_name || '',
                tour_name: show.tour_name || '',
                notes: show.notes || '',
                has_images: show.has_images || false,
                source_types: show.source_types || []
            });
            setInitialSetlist(show.setlist || {});
        } catch (err) {
            console.error('Error fetching show:', err);
            setError('Failed to load show');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSourceTypeChange = (sourceType) => {
        setFormData(prev => ({
            ...prev,
            source_types: prev.source_types.includes(sourceType)
                ? prev.source_types.filter(t => t !== sourceType)
                : [...prev.source_types, sourceType]
        }));
    };

    const handleVenueFormChange = (e) => {
        const { name, value } = e.target;
        setVenueFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateVenue = async (e) => {
        e.preventDefault();
        setVenueFormError('');
        try {
            const newVenue = await createVenue(venueFormData);
            setVenues(prev => [...prev, newVenue].sort((a, b) => a.name.localeCompare(b.name)));
            setFormData(prev => ({ ...prev, venue_id: newVenue.id }));
            setVenueFormData({ name: '', city: '', state_country: '', address: '' });
            setShowVenueForm(false);
        } catch (err) {
            console.error('Error creating venue:', err);
            setVenueFormError(err.message || 'Failed to create venue');
        }
    };

    const handleCancelVenueForm = () => {
        setShowVenueForm(false);
        setVenueFormError('');
        setVenueFormData({ name: '', city: '', state_country: '', address: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            let showId = id;
            if (isEdit) {
                await updateShow(id, formData);
            } else {
                const newShow = await createShow(formData);
                showId = newShow.id;
            }
            if (setlistData.length > 0 || isEdit) {
                await updateSetlist(showId, setlistData);
            }
            navigate('/admin/shows');
        } catch (err) {
            console.error('Error saving show:', err);
            setError(err.message || 'Failed to save show');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    return (
        <div className="space-y-6">
            <PHeading size="2xl" tag="h1">{isEdit ? 'Edit Show' : 'Add New Show'}</PHeading>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Show Date <span style={{ color: 'var(--p-color-error)' }}>*</span>
                        </label>
                        <input type="date" name="show_date" value={formData.show_date}
                            onChange={handleChange} required className={inputClass} />
                    </div>

                    <div>
                        <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Artist Name <span style={{ color: 'var(--p-color-error)' }}>*</span>
                        </label>
                        <input type="text" name="artist_name" value={formData.artist_name}
                            onChange={handleChange} required className={inputClass} />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)', marginBottom: 0 }}>
                                Venue <span style={{ color: 'var(--p-color-error)' }}>*</span>
                            </label>
                            {!showVenueForm && (
                                <PButtonPure size="x-small" onClick={() => setShowVenueForm(true)}>
                                    + Add New Venue
                                </PButtonPure>
                            )}
                        </div>

                        {!showVenueForm ? (
                            <select name="venue_id" value={formData.venue_id} onChange={handleChange} required
                                className={selectClass}
                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                <option value="">Select a venue</option>
                                {venues.map(venue => (
                                    <option key={venue.id} value={venue.id}>
                                        {venue.name} - {venue.city}, {venue.state_country}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                                <PHeading size="sm" tag="h3">Create New Venue</PHeading>
                                {venueFormError && (
                                    <PInlineNotification heading="Error" description={venueFormError}
                                        state="error" dismissButton={false} />
                                )}
                                {[
                                    { name: 'name', label: 'Venue Name', placeholder: 'e.g., Red Rocks Amphitheatre', required: true },
                                    { name: 'city', label: 'City', placeholder: 'e.g., Morrison', required: true },
                                    { name: 'state_country', label: 'State/Country', placeholder: 'e.g., CO or United States', required: true },
                                    { name: 'address', label: 'Address (Optional)', placeholder: 'e.g., 18300 W Alameda Pkwy' },
                                ].map(({ name, label, placeholder, required }) => (
                                    <div key={name}>
                                        <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                                            {label}
                                        </label>
                                        <input type="text" name={name} value={venueFormData[name]}
                                            onChange={handleVenueFormChange} required={required}
                                            placeholder={placeholder} className={inputClass} />
                                    </div>
                                ))}
                                <div className="flex gap-2 pt-1">
                                    <PButton type="button" size="small" onClick={handleCreateVenue}>Create Venue</PButton>
                                    <PButton type="button" variant="secondary" size="small" onClick={handleCancelVenueForm}>
                                        Cancel
                                    </PButton>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Tour Name
                        </label>
                        <input type="text" name="tour_name" value={formData.tour_name}
                            onChange={handleChange} className={inputClass} />
                    </div>
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Notes</label>
                    <textarea name="notes" value={formData.notes} onChange={handleChange} rows="4"
                        className={inputClass + ' resize-none'} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Source Types</label>
                    <div className="flex flex-wrap gap-4">
                        {sourceTypeOptions.map(sourceType => (
                            <label key={sourceType} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={formData.source_types.includes(sourceType)}
                                    onChange={() => handleSourceTypeChange(sourceType)} className="w-4 h-4" />
                                <PText size="small">{sourceType}</PText>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" name="has_images" checked={formData.has_images}
                            onChange={handleChange} className="w-4 h-4" />
                        <PText size="small" weight="semi-bold">Has Images</PText>
                    </label>
                </div>

                <div className="flex gap-3 pt-2 border-t border-white/10">
                    <PButton type="submit" loading={saving}>
                        {isEdit ? 'Update Show' : 'Create Show'}
                    </PButton>
                    <PButton type="button" variant="secondary" onClick={() => navigate('/admin/shows')}>
                        Cancel
                    </PButton>
                </div>
            </form>

            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6">
                <SetlistEditor initialSetlist={initialSetlist} onChange={setSetlistData} />
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--p-color-info)', background: 'color-mix(in srgb, var(--p-color-info) 10%, transparent)' }}>
                <PText size="small" style={{ color: 'var(--p-color-info)' }}>
                    Make sure to click "{isEdit ? 'Update' : 'Create'} Show" above to save both the show details and the setlist.
                </PText>
            </div>
        </div>
    );
}
