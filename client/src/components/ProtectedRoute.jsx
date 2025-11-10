import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
    const { user, isAdmin, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-xl text-gray-300">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check if user is admin
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-2xl border border-gray-700 text-center">
                    <h2 className="text-2xl font-bold text-red-400 mb-4">Access Denied</h2>
                    <p className="text-gray-300 mb-6">You do not have permission to access the admin panel.</p>
                    <a href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                        ← Return to Home
                    </a>
                </div>
            </div>
        );
    }

    return children;
}

