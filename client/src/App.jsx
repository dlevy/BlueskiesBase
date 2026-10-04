import { BrowserRouter as Router, Routes, Route, Link, Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { PButtonPure } from '@porsche-design-system/components-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AvatarNudgeProvider } from './contexts/AvatarNudgeContext'
import { setTokenGetter, getSiteSettings } from './services/api'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import ShowDetailPage from './pages/ShowDetailPage'
import StatsPage from './pages/StatsPage'
import PostersPage from './pages/PostersPage'
import BandPage from './pages/BandPage'
import BandMemberPage from './pages/BandMemberPage'
import PhotosPage from './pages/PhotosPage'
import LinksPage from './pages/LinksPage'
import MembersPage from './pages/MembersPage'
import TourStatsPage from './pages/TourStatsPage'
import UpcomingShowsPage from './pages/UpcomingShowsPage'
import ProfilePage from './pages/ProfilePage'
import EditProfilePage from './pages/EditProfilePage'
import LoginPage from './pages/LoginPage'
import MemberLoginPage from './pages/MemberLoginPage'
import SignupPage from './pages/SignupPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AuthDebugPage from './pages/AuthDebugPage'
import InstagramFollowBanner from './components/InstagramFollowBanner'
import Avatar from './components/Avatar'
import NotificationBell from './components/NotificationBell'
import NotificationsPage from './pages/NotificationsPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import ShowsList from './pages/admin/ShowsList'
import ShowForm from './pages/admin/ShowForm'
import SongsList from './pages/admin/SongsList'
import AlbumsList from './pages/admin/AlbumsList'
import LinksList from './pages/admin/LinksList'
import VenuesList from './pages/admin/VenuesList'
import BandMembersList from './pages/admin/BandMembersList'
import ToursList from './pages/admin/ToursList'
import TourEditPage from './pages/admin/TourEditPage'
import AdminUsers from './pages/admin/AdminUsers'
import SiteSettingsPage from './pages/admin/SiteSettingsPage'
import SetlistSubmissionsReview from './pages/admin/SetlistSubmissionsReview'
import InstagramPostPage from './pages/admin/InstagramPostPage'
import ArtworkPage from './pages/ArtworkPage'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <AvatarNudgeProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="show/:artist/:date/:locationSlug" element={<ShowDetailPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="posters" element={<PostersPage />} />
            <Route path="band" element={<BandPage />} />
            <Route path="band/:slug" element={<BandMemberPage />} />
            <Route path="artwork/:id" element={<ArtworkPage />} />
            <Route path="photos" element={<PhotosPage />} />
            <Route path="links" element={<LinksPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="tour-stats" element={<TourStatsPage />} />
            <Route path="upcoming-shows" element={<UpcomingShowsPage />} />
            {/* Static "edit" segment ranks above the dynamic :username in React
                Router's matcher regardless of declaration order, so a user whose
                username happened to be literally "edit" would have an unreachable
                profile at this URL — acceptable edge case since usernames are
                currently auto-generated, not user-chosen. */}
            <Route path="profile/edit" element={<EditProfilePage />} />
            <Route path="profile/:username" element={<ProfilePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* Member Auth Routes */}
          <Route path="/member-login" element={<MemberLoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

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
            <Route path="shows/:id/instagram" element={<InstagramPostPage />} />
            <Route path="songs" element={<SongsList />} />
            <Route path="albums" element={<AlbumsList />} />
            <Route path="links" element={<LinksList />} />
            <Route path="venues" element={<VenuesList />} />
            <Route path="band-members" element={<BandMembersList />} />
            <Route path="tours" element={<ToursList />} />
            <Route path="tours/:tourName" element={<TourEditPage />} />
            <Route path="setlist-submissions" element={<SetlistSubmissionsReview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="settings" element={<SiteSettingsPage />} />
          </Route>
        </Routes>
        </AvatarNudgeProvider>
      </Router>
    </AuthProvider>
  )
}

const DEFAULT_HEADER_TITLE = 'Skysets.org - JBS / Sturgill Simpson Media Archive';
const DEFAULT_HEADER_SUBTITLE = 'Johnny Blue Skies & The Dark Clouds Concert Setlist Archive';
const DEFAULT_FOOTER_LINKS = [
  { text: 'Created and maintained by Daniel Levy', url: null },
  { text: 'Initial setlist import thanks to Setlist.fm', url: 'https://www.setlist.fm' },
  { text: 'Inspired by crowesbase.com', url: 'https://www.crowesbase.com' },
];

function PublicLayout() {
  const { user, profile, isEditorOrAdmin, signOut, getToken } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  // Defaults match the historical hardcoded text exactly, so there's no
  // flash/layout shift for the common case where an admin hasn't changed it —
  // this just gets overwritten once the fetch resolves, if it differs.
  const [headerTitle, setHeaderTitle] = useState(DEFAULT_HEADER_TITLE);
  const [headerSubtitle, setHeaderSubtitle] = useState(DEFAULT_HEADER_SUBTITLE);
  const [footerLinks, setFooterLinks] = useState(DEFAULT_FOOTER_LINKS);

  useEffect(() => {
    if (getToken) {
      setTokenGetter(getToken);
    }
  }, [getToken]);

  useEffect(() => {
    getSiteSettings()
      .then(data => {
        if (data.headerTitle) setHeaderTitle(data.headerTitle);
        if (data.headerSubtitle !== undefined) setHeaderSubtitle(data.headerSubtitle);
        if (data.footerLinks) setFooterLinks(data.footerLinks);
      })
      .catch(err => console.error('[PublicLayout] Error loading site settings:', err));
  }, []);

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
            <img src="/logo.png" alt="" className="h-12 w-12 shrink-0" />
            <div className="flex flex-col items-start min-w-0">
              <span className="font-display font-bold text-lg leading-none" style={{ color: 'var(--p-color-primary)' }}>
                {headerTitle}
              </span>
              {headerSubtitle && (
                <span
                  className="hidden md:block text-xs mt-0.5 truncate"
                  style={{ color: 'var(--p-color-contrast-low)' }}
                >
                  {headerSubtitle}
                </span>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {user ? (
              <>
                <NotificationBell />
                <Link
                  to={profile?.username ? `/profile/${profile.username}` : '/profile/edit'}
                  title="My Profile"
                  aria-label="My Profile"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Avatar url={profile?.avatar_url} name={profile?.display_name || profile?.username || user.email} size="sm" />
                  <span
                    className="hidden md:block text-sm truncate max-w-[140px]"
                    style={{ color: 'var(--p-color-contrast-medium)' }}
                  >
                    {profile?.display_name || profile?.username || user.email}
                  </span>
                </Link>
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

      <InstagramFollowBanner />

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer — full-bleed */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="font-display font-semibold text-sm" style={{ color: 'var(--p-color-contrast-low)' }}>
              SkySets.org
            </span>
            <div className="flex items-center gap-4">
              <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                A fan archive. Not affiliated with Sturgill Simpson.
              </span>
              {isEditorOrAdmin && (
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
          {footerLinks.length > 0 && (
            <div className="flex flex-col items-center gap-y-1">
              {[footerLinks.slice(0, 4), footerLinks.slice(4, 8)].filter(row => row.length > 0).map((row, rowIndex) => (
                <div key={rowIndex} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                  {row.map((item, i) => (
                    <span key={i} className="flex items-center gap-x-3">
                      <span className="text-xs text-center" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:opacity-80 transition-opacity underline underline-offset-2"
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                          >
                            {item.text}
                          </a>
                        ) : (
                          item.text
                        )}
                      </span>
                      {i < row.length - 1 && (
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App
