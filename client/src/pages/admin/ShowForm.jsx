import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getShowById, createShow, updateShow, deleteShow, getVenues, updateSetlist, createVenue, getBands, createBand } from '../../services/api';
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
    const [bands, setBands] = useState([]);
    const [setlistData, setSetlistData] = useState([]);
    const [initialSetlist, setInitialSetlist] = useState({});
    const [showVenueForm, setShowVenueForm] = useState(false);
    const [venueFormData, setVenueFormData] = useState({ name: '', city: '', state_country: '', address: '' });
    const [venueFormError, setVenueFormError] = useState('');
    const [showOpenedForForm, setShowOpenedForForm] = useState(false);
    const [showOpeningActForm, setShowOpeningActForm] = useState(false);
    const [newBandName, setNewBandName] = useState('');
    const [bandFormError, setBandFormError] = useState('');
    const [showLinkForm, setShowLinkForm] = useState(false);
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [newLinkDescription, setNewLinkDescription] = useState('');
    const [linkFormError, setLinkFormError] = useState('');

    const [formData, setFormData] = useState({
        venue_id: '',
        show_date: '',
        artist_name: 'Johnny Blue Skies',
        tour_name: '',
        notes: '',
        has_images: false,
        source_types: [],
        opened_for_id: '',
        opening_act_id: '',
        links: [],
    });

    const sourceTypeOptions = ['SBD', 'AUD', 'Matrix', 'FM', 'Video'];

    useEffect(() => {
        fetchVenues();
        fetchBands();
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

    const fetchBands = async () => {
        try {
            const data = await getBands();
            setBands(data.bands || []);
        } catch (err) {
            console.error('Error fetching bands:', err);
        }
    };

    const fetchShow = async () => {
        try {
            setLoading(true);
            const show = await getShowById(id);
            setFormData({
                venue_id:       show.venue_id       || '',
                show_date:      show.show_date       || '',
                artist_name:    show.artist_name     || '',
                tour_name:      show.tour_name       || '',
                notes:          show.notes           || '',
                has_images:     show.has_images      || false,
                source_types:   show.source_types    || [],
                opened_for_id:  show.opened_for_id   || '',
                opening_act_id: show.opening_act_id  || '',
                links:          show.links           || [],
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

    const handleAddBand = async (field, closeForm) => {
        setBandFormError('');
        try {
            const band = await createBand(newBandName.trim());
            setBands(prev => [...prev, band].sort((a, b) => a.name.localeCompare(b.name)));
            setFormData(prev => ({ ...prev, [field]: band.id }));
            setNewBandName('');
            closeForm(false);
        } catch (err) {
            setBandFormError(err.message || 'Failed to create band');
        }
    };

    const handleAddLink = () => {
        const url = newLinkUrl.trim();
        if (!url) { setLinkFormError('URL is required'); return; }
        try { new URL(url); } catch { setLinkFormError('Please enter a valid URL'); return; }
        setLinkFormError('');
        setFormData(prev => ({ ...prev, links: [...prev.links, { url, description: newLinkDescription.trim() }] }));
        setNewLinkUrl('');
        setNewLinkDescription('');
        setShowLinkForm(false);
    };

    const removeLink = (index) => {
        setFormData(prev => ({ ...prev, links: prev.links.filter((_, i) => i !== index) }));
    };

    const handleDelete = async () => {
        if (!confirm(`Permanently delete this show? This cannot be undone.`)) return;
        try {
            await deleteShow(id);
            navigate('/admin/shows');
        } catch (err) {
            console.error('Error deleting show:', err);
            setError(err.message || 'Failed to delete show');
        }
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

                    {/* Opened For */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)', marginBottom: 0 }}>
                                Opened For
                            </label>
                            {!showOpenedForForm && (
                                <PButtonPure type="button" size="x-small" onClick={() => { setShowOpenedForForm(true); setBandFormError(''); setNewBandName(''); }}>
                                    + Add New Band
                                </PButtonPure>
                            )}
                        </div>
                        {!showOpenedForForm ? (
                            <select name="opened_for_id" value={formData.opened_for_id} onChange={handleChange}
                                className={selectClass}
                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                <option value="">— None —</option>
                                {bands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        ) : (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                                <PHeading size="sm" tag="h3">Add Band</PHeading>
                                {bandFormError && <PInlineNotification heading="Error" description={bandFormError} state="error" dismissButton={false} />}
                                <input type="text" value={newBandName} onChange={e => setNewBandName(e.target.value)}
                                    placeholder="Band name" className={inputClass} />
                                <div className="flex gap-2">
                                    <PButton type="button" size="small" onClick={() => handleAddBand('opened_for_id', setShowOpenedForForm)}>Add</PButton>
                                    <PButton type="button" variant="secondary" size="small" onClick={() => { setShowOpenedForForm(false); setBandFormError(''); }}>Cancel</PButton>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Opening Act */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)', marginBottom: 0 }}>
                                Opening Act
                            </label>
                            {!showOpeningActForm && (
                                <PButtonPure type="button" size="x-small" onClick={() => { setShowOpeningActForm(true); setBandFormError(''); setNewBandName(''); }}>
                                    + Add New Band
                                </PButtonPure>
                            )}
                        </div>
                        {!showOpeningActForm ? (
                            <select name="opening_act_id" value={formData.opening_act_id} onChange={handleChange}
                                className={selectClass}
                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                <option value="">— None —</option>
                                {bands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        ) : (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                                <PHeading size="sm" tag="h3">Add Band</PHeading>
                                {bandFormError && <PInlineNotification heading="Error" description={bandFormError} state="error" dismissButton={false} />}
                                <input type="text" value={newBandName} onChange={e => setNewBandName(e.target.value)}
                                    placeholder="Band name" className={inputClass} />
                                <div className="flex gap-2">
                                    <PButton type="button" size="small" onClick={() => handleAddBand('opening_act_id', setShowOpeningActForm)}>Add</PButton>
                                    <PButton type="button" variant="secondary" size="small" onClick={() => { setShowOpeningActForm(false); setBandFormError(''); }}>Cancel</PButton>
                                </div>
                            </div>
                        )}
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

                {/* Links */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)', marginBottom: 0 }}>
                            Links
                        </label>
                        {!showLinkForm && (
                            <PButtonPure type="button" size="x-small" onClick={() => { setShowLinkForm(true); setNewLinkUrl(''); setNewLinkDescription(''); setLinkFormError(''); }}>
                                + Add Link
                            </PButtonPure>
                        )}
                    </div>

                    {formData.links.length > 0 && (
                        <div className="space-y-2 mb-3">
                            {formData.links.map((link, i) => (
                                <div key={i} className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="text-xs text-amber-400 truncate">{link.url}</p>
                                        {link.description && (
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>{link.description}</p>
                                        )}
                                    </div>
                                    <PButtonPure type="button" size="x-small" onClick={() => removeLink(i)}
                                        style={{ color: 'var(--p-color-notification-error)', flexShrink: 0 }}>
                                        Remove
                                    </PButtonPure>
                                </div>
                            ))}
                        </div>
                    )}

                    {showLinkForm && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                            <PHeading size="sm" tag="h3">Add Link</PHeading>
                            {linkFormError && <PInlineNotification heading="Error" description={linkFormError} state="error" dismissButton={false} />}
                            <div>
                                <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>URL</label>
                                <input type="url" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)}
                                    placeholder="https://youtube.com/watch?v=..." className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Description <span style={{ color: 'var(--p-color-contrast-medium)', fontWeight: 'normal' }}>(optional for YouTube)</span></label>
                                <input type="text" value={newLinkDescription} onChange={e => setNewLinkDescription(e.target.value)}
                                    placeholder="e.g. Full show recording" className={inputClass} />
                            </div>
                            <div className="flex gap-2">
                                <PButton type="button" size="small" onClick={handleAddLink}>Add</PButton>
                                <PButton type="button" variant="secondary" size="small" onClick={() => { setShowLinkForm(false); setLinkFormError(''); }}>Cancel</PButton>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <div className="flex gap-3">
                        <PButton type="submit" loading={saving}>
                            {isEdit ? 'Update Show' : 'Create Show'}
                        </PButton>
                        <PButton type="button" variant="secondary" onClick={() => navigate('/admin/shows')}>
                            Cancel
                        </PButton>
                    </div>
                    {isEdit && (
                        <button type="button" onClick={handleDelete}
                            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-red-500/10"
                            style={{ color: 'var(--p-color-notification-error)', borderColor: 'var(--p-color-notification-error)' }}>
                            Delete Show
                        </button>
                    )}
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
