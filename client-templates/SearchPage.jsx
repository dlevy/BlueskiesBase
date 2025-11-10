// This is a template for the main search page
// Create this at: client/src/pages/SearchPage.jsx

import { useState } from 'react';

export default function SearchPage() {
    const [searchParams, setSearchParams] = useState({
        year: '',
        month: '',
        day: '',
        venue: '',
        city: '',
        state: '',
        song: '',
        source: '',
        hasImages: false
    });
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Build query string
            const params = new URLSearchParams();
            Object.entries(searchParams).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const response = await fetch(`http://localhost:3000/api/search/shows?${params}`);
            const data = await response.json();
            setResults(data.shows || []);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSearchParams(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-8 text-center">
                Search Setlists
            </h1>

            <form onSubmit={handleSearch} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Date Search */}
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Year
                        </label>
                        <select
                            name="year"
                            value={searchParams.year}
                            onChange={handleInputChange}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700"
                        >
                            <option value="">All Years</option>
                            {Array.from({ length: 35 }, (_, i) => 2025 - i).map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Month
                        </label>
                        <select
                            name="month"
                            value={searchParams.month}
                            onChange={handleInputChange}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700"
                        >
                            <option value="">All Months</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                <option key={month} value={month}>
                                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Day
                        </label>
                        <select
                            name="day"
                            value={searchParams.day}
                            onChange={handleInputChange}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700"
                        >
                            <option value="">All Days</option>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Location Search */}
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Venue
                        </label>
                        <input
                            type="text"
                            name="venue"
                            value={searchParams.venue}
                            onChange={handleInputChange}
                            placeholder="e.g., The Fillmore"
                            className="shadow border rounded w-full py-2 px-3 text-gray-700"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            City
                        </label>
                        <input
                            type="text"
                            name="city"
                            value={searchParams.city}
                            onChange={handleInputChange}
                            placeholder="e.g., San Francisco"
                            className="shadow border rounded w-full py-2 px-3 text-gray-700"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            State/Country
                        </label>
                        <input
                            type="text"
                            name="state"
                            value={searchParams.state}
                            onChange={handleInputChange}
                            placeholder="e.g., CA"
                            className="shadow border rounded w-full py-2 px-3 text-gray-700"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Song
                        </label>
                        <input
                            type="text"
                            name="song"
                            value={searchParams.song}
                            onChange={handleInputChange}
                            placeholder="e.g., Remedy"
                            className="shadow border rounded w-full py-2 px-3 text-gray-700"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </form>

            {/* Results */}
            <div className="bg-white shadow-md rounded px-8 pt-6 pb-8">
                <h2 className="text-2xl font-bold mb-4">
                    Results {results.length > 0 && `(${results.length})`}
                </h2>

                {results.length === 0 ? (
                    <p className="text-gray-600">No shows found. Try adjusting your search criteria.</p>
                ) : (
                    <div className="space-y-4">
                        {results.map(show => (
                            <div key={show.id} className="border-b pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-semibold">
                                            {new Date(show.show_date).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </h3>
                                        <p className="text-gray-700">
                                            {show.artist_name}
                                        </p>
                                        {show.venues && (
                                            <p className="text-gray-600">
                                                {show.venues.name} - {show.venues.city}, {show.venues.state_country}
                                            </p>
                                        )}
                                        {show.tour_name && (
                                            <p className="text-sm text-gray-500 italic">{show.tour_name}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        {show.source_types && show.source_types.length > 0 && (
                                            <div className="text-sm text-gray-600">
                                                Sources: {show.source_types.join(', ')}
                                            </div>
                                        )}
                                        {show.has_images && (
                                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                                Has Images
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <a
                                    href={`/show/${show.id}`}
                                    className="text-blue-500 hover:text-blue-700 text-sm mt-2 inline-block"
                                >
                                    View Setlist →
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

