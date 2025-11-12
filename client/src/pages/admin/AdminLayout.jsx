import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLayout() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
        if (isSigningOut) return; // Prevent double-clicks

        setIsSigningOut(true);
        console.log('[AdminLayout] Sign out button clicked');

        try {
            await signOut();
            console.log('[AdminLayout] Sign out successful, navigating to home');
            navigate('/');
        } catch (error) {
            console.error('[AdminLayout] Error signing out:', error);
            alert('Failed to sign out. Please try again.');
        } finally {
            setIsSigningOut(false);
        }
    };

    return (
        <div className="min-h-screen bg-black">
            <div className="container mx-auto px-4">
                {/* Admin Header */}
                <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-2xl border-b border-gray-700 rounded-t-2xl mt-4">
                    <div className="px-4 py-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <Link to="/admin" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
                                    blueskiesbase admin
                                </Link>
                                <p className="text-sm text-gray-400">Logged in as: {user?.email}</p>
                            </div>
                            <div className="flex gap-4 items-center">
                                <Link to="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                                    View Site
                                </Link>
                                <button
                                    onClick={handleSignOut}
                                    disabled={isSigningOut}
                                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Admin Navigation */}
                <nav className="bg-gray-800 shadow-lg border-b border-gray-700">
                    <div className="px-4">
                        <ul className="flex space-x-6 py-4">
                            <li>
                                <Link
                                    to="/admin"
                                    className="text-gray-300 hover:text-blue-400 font-medium transition-colors"
                                >
                                    Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/admin/shows"
                                    className="text-gray-300 hover:text-blue-400 font-medium transition-colors"
                                >
                                    Shows
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/admin/songs"
                                    className="text-gray-300 hover:text-blue-400 font-medium transition-colors"
                                >
                                    Songs
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/admin/albums"
                                    className="text-gray-300 hover:text-blue-400 font-medium transition-colors"
                                >
                                    Albums
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/admin/venues"
                                    className="text-gray-300 hover:text-blue-400 font-medium transition-colors"
                                >
                                    Venues
                                </Link>
                            </li>
                        </ul>
                    </div>
                </nav>

                {/* Main Content */}
                <main className="bg-gray-900 px-4 py-8 rounded-b-2xl mb-4">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

