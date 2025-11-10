import { Link } from 'react-router-dom';

export default function AdminDashboard() {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Admin Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Shows Card */}
                <Link to="/admin/shows" className="bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-700 hover:border-blue-500 transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-100">Shows</h2>
                        <span className="text-3xl">🎸</span>
                    </div>
                    <p className="text-gray-400 mb-4">
                        Manage concert shows, setlists, and performance details
                    </p>
                    <div className="text-blue-400 font-medium">
                        Manage Shows →
                    </div>
                </Link>

                {/* Songs Card */}
                <Link to="/admin/songs" className="bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-700 hover:border-blue-500 transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-100">Songs</h2>
                        <span className="text-3xl">🎵</span>
                    </div>
                    <p className="text-gray-400 mb-4">
                        Manage song catalog and track performance history
                    </p>
                    <div className="text-blue-400 font-medium">
                        Manage Songs →
                    </div>
                </Link>

                {/* Venues Card */}
                <Link to="/admin/venues" className="bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-700 hover:border-blue-500 transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-100">Venues</h2>
                        <span className="text-3xl">🏛️</span>
                    </div>
                    <p className="text-gray-400 mb-4">
                        Manage venue information and locations
                    </p>
                    <div className="text-blue-400 font-medium">
                        Manage Venues →
                    </div>
                </Link>
            </div>

            {/* Quick Stats */}
            <div className="mt-8 bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-700">
                <h2 className="text-2xl font-bold mb-4 text-gray-100">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        to="/admin/shows/new"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-center font-medium transition-colors"
                    >
                        + Add New Show
                    </Link>
                    <Link
                        to="/admin/songs/new"
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-center font-medium transition-colors"
                    >
                        + Add New Song
                    </Link>
                    <Link
                        to="/admin/venues/new"
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg text-center font-medium transition-colors"
                    >
                        + Add New Venue
                    </Link>
                </div>
            </div>
        </div>
    );
}

