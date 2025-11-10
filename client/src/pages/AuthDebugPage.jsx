import { useAuth } from '../contexts/AuthContext';

export default function AuthDebugPage() {
    const { user, profile, isAdmin, loading } = useAuth();

    return (
        <div className="px-4 py-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-100 mb-6">Auth Debug Info</h1>
            
            <div className="space-y-4">
                {/* Loading State */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h2 className="text-xl font-semibold text-gray-100 mb-2">Loading State</h2>
                    <p className="text-gray-300">
                        Loading: <span className={loading ? 'text-yellow-400' : 'text-green-400'}>
                            {loading ? 'TRUE (still loading...)' : 'FALSE (loaded)'}
                        </span>
                    </p>
                </div>

                {/* User State */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h2 className="text-xl font-semibold text-gray-100 mb-2">User State</h2>
                    {user ? (
                        <div className="text-gray-300 space-y-1">
                            <p>✅ User is logged in</p>
                            <p>Email: <span className="text-blue-400">{user.email}</span></p>
                            <p>ID: <span className="text-gray-500 text-sm">{user.id}</span></p>
                        </div>
                    ) : (
                        <p className="text-red-400">❌ No user logged in</p>
                    )}
                </div>

                {/* Profile State */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h2 className="text-xl font-semibold text-gray-100 mb-2">Profile State</h2>
                    {profile ? (
                        <div className="text-gray-300 space-y-1">
                            <p>✅ Profile loaded</p>
                            <p>Username: <span className="text-blue-400">{profile.username}</span></p>
                            <p>Is Admin: <span className={profile.is_admin ? 'text-green-400' : 'text-red-400'}>
                                {profile.is_admin ? 'YES ✅' : 'NO ❌'}
                            </span></p>
                            <p>Created: <span className="text-gray-500 text-sm">
                                {new Date(profile.created_at).toLocaleString()}
                            </span></p>
                        </div>
                    ) : (
                        <p className="text-yellow-400">⚠️ No profile loaded</p>
                    )}
                </div>

                {/* Admin Status */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h2 className="text-xl font-semibold text-gray-100 mb-2">Admin Status</h2>
                    <p className="text-gray-300">
                        isAdmin: <span className={isAdmin ? 'text-green-400' : 'text-red-400'}>
                            {isAdmin ? 'TRUE ✅' : 'FALSE ❌'}
                        </span>
                    </p>
                </div>

                {/* Raw Data */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h2 className="text-xl font-semibold text-gray-100 mb-2">Raw Data (JSON)</h2>
                    <pre className="text-xs text-gray-400 overflow-auto">
                        {JSON.stringify({ 
                            loading, 
                            user: user ? { id: user.id, email: user.email } : null,
                            profile,
                            isAdmin 
                        }, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}

