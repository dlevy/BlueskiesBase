import { BrowserRouter as Router, Routes, Route, Link, Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { PButtonPure } from '@porsche-design-system/components-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { setTokenGetter } from './services/api'
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
import ChatWidget from './components/ChatWidget'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="show/:artist/:date/:locationSlug" element={<ShowDetailPage />} />
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

function PublicLayout() {
  const { user, isAdmin, signOut, getToken } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (getToken) {
      setTokenGetter(getToken);
    }
  }, [getToken]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('[PublicLayout] Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--p-color-canvas)' }}>
      {/* Header — full-bleed, sticky */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: 'color-mix(in srgb, var(--p-color-canvas) 88%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between h-14">
          <Link to="/" className="hover:opacity-80 transition-opacity flex items-center gap-2.5 min-w-0">
            <img src="/logo.svg" alt="" className="h-9 w-9 shrink-0" />
            <div className="flex flex-col items-start min-w-0">
              <span className="font-display font-bold text-lg leading-none" style={{ color: 'var(--p-color-primary)' }}>
                SkySets.org
              </span>
              <span
                className="hidden md:block text-xs mt-0.5 truncate"
                style={{ color: 'var(--p-color-contrast-low)' }}
              >
                Sturgill Simpson &amp; Johnny Blue Skies setlist archive
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {user ? (
              <>
                <span
                  className="hidden md:block text-sm truncate max-w-[180px]"
                  style={{ color: 'var(--p-color-contrast-medium)' }}
                >
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="h-7 px-3 rounded-md text-xs font-medium border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50"
                  style={{ color: 'var(--p-color-contrast-medium)' }}
                >
                  {isSigningOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link to="/member-login">
                  <PButtonPure>Login</PButtonPure>
                </Link>
                <Link to="/signup">
                  <button className="h-8 px-3 rounded-lg text-sm font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-colors">
                    Sign Up
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer — full-bleed */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-display font-semibold text-sm" style={{ color: 'var(--p-color-contrast-low)' }}>
            SkySets.org
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
              A fan archive. Not affiliated with Sturgill Simpson.
            </span>
            {isAdmin && (
              <Link
                to="/admin"
                className="text-xs hover:opacity-80 transition-opacity"
                style={{ color: 'var(--p-color-info)' }}
              >
                Admin
              </Link>
            )}
          </div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}

export default App
