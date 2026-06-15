import { BrowserRouter as Router, Routes, Route, Link, Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { PHeading, PText, PButton, PButtonPure } from '@porsche-design-system/components-react'
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
    <div className="min-h-screen" style={{ background: 'var(--p-color-canvas)' }}>
      <div className="container mx-auto px-4">
        <header
          className="py-4 md:py-6 shadow-xl border-b border-white/10 rounded-t-2xl mt-4"
          style={{ background: 'var(--p-color-surface)' }}
        >
          <div className="px-4 md:px-6">
            {/* Mobile Layout */}
            <div className="md:hidden">
              <div className="flex justify-between items-center mb-3">
                <Link to="/" className="hover:opacity-80 transition-opacity">
                  <PHeading size="lg" tag="h1">blueskiesbase</PHeading>
                </Link>
              </div>
              {user ? (
                <div className="flex items-center justify-between gap-2">
                  <PText size="xs" color="contrast-medium" className="truncate max-w-[180px]">
                    {user.email}
                  </PText>
                  <PButton
                    variant="secondary"
                    size="small"
                    loading={isSigningOut}
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </PButton>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/member-login">
                    <PButtonPure>Login</PButtonPure>
                  </Link>
                  <Link to="/signup">
                    <PButton size="small">Sign Up</PButton>
                  </Link>
                </div>
              )}
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex justify-between items-center">
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <PHeading size="xl" tag="h1">Johnny Blue Skies &amp; the Dark Clouds</PHeading>
                <PText size="xs" color="contrast-medium">
                  A concert archive for fans of Sturgill Simpson, Johnny Blue Skies, and the Dark Clouds
                </PText>
              </Link>
              <div className="flex items-center gap-3">
                {user ? (
                  <>
                    <PText size="sm" color="contrast-medium">{user.email}</PText>
                    <PButton
                      variant="secondary"
                      loading={isSigningOut}
                      onClick={handleSignOut}
                    >
                      Sign Out
                    </PButton>
                  </>
                ) : (
                  <>
                    <Link to="/member-login">
                      <PButtonPure>Login</PButtonPure>
                    </Link>
                    <Link to="/signup">
                      <PButton>Sign Up</PButton>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main style={{ background: 'var(--p-color-canvas)' }}>
          <Outlet />
        </main>

        <footer
          className="py-6 border-t border-white/10 rounded-b-2xl mb-4"
          style={{ background: 'var(--p-color-surface)' }}
        >
          <div className="px-4 text-center space-y-1">
            <PText size="xs" color="contrast-medium">blueskiesbase — your concert setlist archive</PText>
            {isAdmin && (
              <div>
                <Link to="/admin" className="text-[var(--p-color-info)] hover:opacity-80 transition-opacity text-xs">
                  Admin Panel
                </Link>
              </div>
            )}
          </div>
        </footer>
      </div>
      <ChatWidget />
    </div>
  );
}

export default App
