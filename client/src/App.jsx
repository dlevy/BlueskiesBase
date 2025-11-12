import { BrowserRouter as Router, Routes, Route, Link, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { setAuthTokenGetter } from './services/api'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import ShowDetailPage from './pages/ShowDetailPage'
import StatsPage from './pages/StatsPage'
import LoginPage from './pages/LoginPage'
import MemberLoginPage from './pages/MemberLoginPage'
import SignupPage from './pages/SignupPage'
import AuthDebugPage from './pages/AuthDebugPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import ShowsList from './pages/admin/ShowsList'
import ShowForm from './pages/admin/ShowForm'
import SongsList from './pages/admin/SongsList'
import AlbumsList from './pages/admin/AlbumsList'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="show/:id" element={<ShowDetailPage />} />
            <Route path="stats" element={<StatsPage />} />
          </Route>

          {/* Member Auth Routes */}
          <Route path="/member-login" element={<MemberLoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Admin Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Debug Route */}
          <Route path="/auth-debug" element={<AuthDebugPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="shows" element={<ShowsList />} />
            <Route path="shows/new" element={<ShowForm />} />
            <Route path="shows/edit/:id" element={<ShowForm />} />
            <Route path="songs" element={<SongsList />} />
            <Route path="albums" element={<AlbumsList />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

// Public Layout Component
function PublicLayout() {
  const { user, isAdmin, signOut, getToken } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Set up the auth token getter for the API module
  useEffect(() => {
    if (getToken) {
      setAuthTokenGetter(getToken);
    }
  }, [getToken]);

  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent double-clicks

    setIsSigningOut(true);
    console.log('[PublicLayout] Sign out button clicked');

    try {
      await signOut();
      console.log('[PublicLayout] Sign out successful, navigating to home');
      navigate('/');
    } catch (error) {
      console.error('[PublicLayout] Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4">
        <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white py-4 md:py-6 shadow-2xl border-b border-blue-800 rounded-t-2xl mt-4">
          <div className="px-2 md:px-4">
            {/* Mobile Layout */}
            <div className="md:hidden">
              <div className="flex justify-between items-center mb-3">
                <Link to="/" className="hover:opacity-80 transition-opacity">
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent">blueskiesbase</h1>
                </Link>
              </div>

              {user ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-blue-300 truncate max-w-[180px]">
                    {user.email}
                  </span>
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-600 rounded-md transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/member-login"
                    className="px-3 py-1.5 text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors border border-blue-700 rounded-md"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-600 rounded-md transition-colors"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex justify-between items-center text-left">
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent">Johnny Blueskies & the Dark Clouds</h1>
                <p className="text-blue-300 text-left text-xs">A concert archive for fans of Sturgill Simpson, Johnny Blueskies, and the Dark Clouds</p>
              </Link>

              <div className="flex items-center gap-4">
                {user ? (
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-blue-300">
                      {user.email}
                    </span>
                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Link
                      to="/member-login"
                      className="px-4 py-2 text-sm font-medium text-blue-300 hover:text-blue-200 transition-colors"
                    >
                      Login
                    </Link>
                    <Link
                      to="/signup"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-600 rounded-md transition-colors"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="bg-gray-900">
          <Outlet />
        </main>

        <footer className="bg-gray-950 text-gray-400 py-6 border-t border-gray-800 rounded-b-2xl mb-4">
          <div className="px-4 text-center">
            <p className="text-sm">blueskiesbase - your concert setlist archive</p>
            {isAdmin && (
              <p className="text-xs mt-2">
                <Link to="/admin" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Admin Panel
                </Link>
              </p>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App
