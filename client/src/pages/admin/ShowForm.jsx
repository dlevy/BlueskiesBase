import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getShowById, createShow, updateShow, getVenues, updateSetlist, createVenue } from '../../services/api';
import SetlistEditor from '../../components/SetlistEditor';

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
    const [venueFormData, setVenueFormData] = useState({
        name: '',
        city: '',
        state_country: '',
        address: ''
    });
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
        if (isEdit) {
            fetchShow();
        }
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
            // Set initial setlist for the editor
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
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSourceTypeChange = (sourceType) => {
        setFormData(prev => ({
            ...prev,
            source_types: prev.source_types.includes(sourceType)
                ? prev.source_types.filter(t => t !== sourceType)
                : [...prev.source_types, sourceType]
        }));
    };

    const handleSetlistChange = (updatedSetlist) => {
        setSetlistData(updatedSetlist);
    };

    const handleVenueFormChange = (e) => {
        const { name, value } = e.target;
        setVenueFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCreateVenue = async (e) => {
        e.preventDefault();
        setVenueFormError('');

        try {
            const newVenue = await createVenue(venueFormData);

            // Add the new venue to the list
            setVenues(prev => [...prev, newVenue].sort((a, b) => a.name.localeCompare(b.name)));

            // Select the new venue
            setFormData(prev => ({
                ...prev,
                venue_id: newVenue.id
            }));

            // Reset and close the form
            setVenueFormData({
                name: '',
                city: '',
                state_country: '',
                address: ''
            });
            setShowVenueForm(false);
        } catch (err) {
            console.error('Error creating venue:', err);
            setVenueFormError(err.message || 'Failed to create venue');
        }
    };

    const handleCancelVenueForm = () => {
        setShowVenueForm(false);
        setVenueFormError('');
        setVenueFormData({
            name: '',
            city: '',
            state_country: '',
            address: ''
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            let showId = id;

            // First, create or update the show
            if (isEdit) {
                await updateShow(id, formData);
            } else {
                const newShow = await createShow(formData);
                showId = newShow.id;
            }

            // Then, update the setlist if there are changes
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
        return <div className="text-center py-8 text-gray-300">Loading...</div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                {isEdit ? 'Edit Show' : 'Add New Show'}
            </h1>

            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-gray-800 shadow-2xl rounded-lg p-6 border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Show Date */}
                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Show Date *
                        </label>
                        <input
                            type="date"
                            name="show_date"
                            value={formData.show_date}
                            onChange={handleChange}
                            required
                            className="shadow border border-gray-600 rounded w-full py-2 px-3 text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Artist Name */}
                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Artist Name *
                        </label>
                        <input
                            type="text"
                            name="artist_name"
                            value={formData.artist_name}
                            onChange={handleChange}
                            required
                            className="shadow border border-gray-600 rounded w-full py-2 px-3 text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Venue */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-gray-300 text-sm font-bold">
                                Venue *
                            </label>
                            {!showVenueForm && (
                                <button
                                    type="button"
                                    onClick={() => setShowVenueForm(true)}
                                    className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                                >
                                    + Add New Venue
                                </button>
                            )}
                        </div>

                        {!showVenueForm ? (
                            <select
                                name="venue_id"
                                value={formData.venue_id}
                                onChange={handleChange}
                                required
                                className="shadow border border-gray-600 rounded w-full py-2 px-3 text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select a venue</option>
                                {venues.map(venue => (
                                    <option key={venue.id} value={venue.id}>
                                        {venue.name} - {venue.city}, {venue.state_country}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="border border-blue-500 rounded-lg p-4 bg-gray-750">
                                <h3 className="text-lg font-semibold text-blue-400 mb-3">Create New Venue</h3>

                                {venueFormError && (
                                    <div className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded mb-3 text-sm">
                                        {venueFormError}
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-gray-300 text-sm font-medium mb-1">
                                            Venue Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={venueFormData.name}
                                            onChange={handleVenueFormChange}
                                            required
                                            className="shadow border border-gray-600 rounded w-full py-2 px-3 text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., Red Rocks Amphitheatre"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-gray-300 text-sm font-medium mb-1">
                                            City *
                                        </label>
                                        <input
                                            type="text"
                                            name="city"
                                            value={venueFormData.city}
                                            onChange={handleVenueFormChange}
                                            required
                                            className="shadow border border-gray-600 rounded w-full py-2 px-3 text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., Morrison"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-gray-300 text-sm font-medium mb-1">
                                            State/Country *
                                        </label>
                                        <input
                                            type="text"
                                            name="state_country"
                                            value={venueFormData.state_country}
                                            onChange={handleVenueFormChange}
                                            required
                                            className="shadow border border-gray-600 rounded w-full py-2 px-3 text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., CO or United States"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-gray-300 text-sm font-medium mb-1">
                                            Address (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            name="address"
                                            value={venueFormData.address}
                                            onChange={handleVenueFormChange}
                                            className="shadow border border-gray-600 rounded w-full py-2 px-3 text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., 18300 W Alameda Pkwy"
                                        />
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={handleCreateVenue}
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
                                        >
                                            Create Venue
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCancelVenueForm}
                                            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tour Name */}
                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">
                            Tour Name
                        </label>
                        <input
                            type="text"
                            name="tour_name"
                            value={formData.tour_name}
                            onChange={handleChange}
                            className="shadow border border-gray-600 rounded w-full py-2 px-3 text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Notes */}
                <div className="mt-6">
                    <label className="block text-gray-300 text-sm font-bold mb-2">
                        Notes
                    </label>
                    <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        rows="4"
                        className="shadow border border-gray-600 rounded w-full py-2 px-3 text-gray-100 bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Source Types */}
                <div className="mt-6">
                    <label className="block text-gray-300 text-sm font-bold mb-2">
                        Source Types
                    </label>
                    <div className="flex flex-wrap gap-4">
                        {sourceTypeOptions.map(sourceType => (
                            <label key={sourceType} className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={formData.source_types.includes(sourceType)}
                                    onChange={() => handleSourceTypeChange(sourceType)}
                                    className="mr-2"
                                />
                                <span className="text-gray-300">{sourceType}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Has Images */}
                <div className="mt-6">
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            name="has_images"
                            checked={formData.has_images}
                            onChange={handleChange}
                            className="mr-2"
                        />
                        <span className="text-gray-300 font-bold">Has Images</span>
                    </label>
                </div>

                {/* Buttons */}
                <div className="mt-8 flex gap-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 transition-colors"
                    >
                        {saving ? 'Saving...' : (isEdit ? 'Update Show' : 'Create Show')}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/admin/shows')}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </form>

            {/* Setlist Editor */}
            <div className="mt-8 bg-gray-800 shadow-2xl rounded-lg p-6 border border-gray-700">
                <SetlistEditor
                    initialSetlist={initialSetlist}
                    onChange={handleSetlistChange}
                />
            </div>

            {/* Save Reminder */}
            <div className="mt-4 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                    <strong>💡 Tip:</strong> Make sure to click "Save Show" or "{isEdit ? 'Update' : 'Create'} Show" button above to save both the show details and the setlist.
                </p>
            </div>
        </div>
    );
}

