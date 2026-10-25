import { BrowserRouter as Router, Routes, Route, Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { PButtonPure, PSpinner } from '@porsche-design-system/components-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AvatarNudgeProvider } from './contexts/AvatarNudgeContext'
import { SiteSettingsProvider } from './contexts/SiteSettingsContext'
import { setTokenGetter, getSiteSettings } from './services/apiCore'
import { trackPageview } from './utils/analytics'
import ProtectedRoute from './components/ProtectedRoute'
import AnnouncementBanner, { DEFAULT_BANNER } from './components/AnnouncementBanner'
import Avatar from './components/Avatar'
import './App.css'

// Lazy: only signed-in visitors get a bell, so it (and the notification code it
// pulls in) shouldn't ship in everyone's initial bundle.
const NotificationBell = lazy(() => import('./components/NotificationBell'))

// HomePage is the one page component loaded eagerly (bundled into the main
// chunk) — it's what the overwhelming majority of visits land on first, so
// loading it eagerly avoids a second, sequential chunk fetch after the main
// bundle for the single most common case. Every other route (including the
// entire /admin section, which a casual visitor never touches at all) is
// lazy — each becomes its own chunk, fetched only when actually navigated
// to, which is what actually shrinks the bundle PageSpeed flagged as
// render-blocking/delaying LCP on first load.
import HomePage from './pages/HomePage'
const ShowDetailPage = lazy(() => import('./pages/ShowDetailPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const PostersPage = lazy(() => import('./pages/PostersPage'))
const DiscographyPage = lazy(() => import('./pages/DiscographyPage'))
const BandPage = lazy(() => import('./pages/BandPage'))
const BandMemberPage = lazy(() => import('./pages/BandMemberPage'))
const PhotosPage = lazy(() => import('./pages/PhotosPage'))
const LinksPage = lazy(() => import('./pages/LinksPage'))
const MembersPage = lazy(() => import('./pages/MembersPage'))
const TourStatsPage = lazy(() => import('./pages/TourStatsPage'))
const UpcomingShowsPage = lazy(() => import('./pages/UpcomingShowsPage'))
const PastShowsPage = lazy(() => import('./pages/PastShowsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'))
const SocialCardPage = lazy(() => import('./pages/SocialCardPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const MemberLoginPage = lazy(() => import('./pages/MemberLoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const AuthDebugPage = lazy(() => import('./pages/AuthDebugPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ArtworkPage = lazy(() => import('./pages/ArtworkPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const HowToUsePage = lazy(() => import('./pages/HowToUsePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))

// The entire admin section — every page below, plus AdminLayout itself —
// is one of the biggest chunks of this app's code and is never touched by
// a casual visitor, so all of it is lazy.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const ShowsList = lazy(() => import('./pages/admin/ShowsList'))
const ShowForm = lazy(() => import('./pages/admin/ShowForm'))
const SongsList = lazy(() => import('./pages/admin/SongsList'))
const AlbumsList = lazy(() => import('./pages/admin/AlbumsList'))
const LinksList = lazy(() => import('./pages/admin/LinksList'))
const VenuesList = lazy(() => import('./pages/admin/VenuesList'))
const BandMembersList = lazy(() => import('./pages/admin/BandMembersList'))
const ToursList = lazy(() => import('./pages/admin/ToursList'))
const TourEditPage = lazy(() => import('./pages/admin/TourEditPage'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const SiteSettingsPage = lazy(() => import('./pages/admin/SiteSettingsPage'))
const SetlistSubmissionsReview = lazy(() => import('./pages/admin/SetlistSubmissionsReview'))
const InstagramPostPage = lazy(() => import('./pages/admin/InstagramPostPage'))
const TourStatsPostPage = lazy(() => import('./pages/admin/TourStatsPostPage'))
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'))

// Shared fallback for every lazy route above, while its chunk is still
// being fetched — same spinner treatment already used throughout the app
// for in-page async loading states.
function RouteLoadingFallback() {
  return (
    <div className="flex justify-center items-center py-24">
      <PSpinner size="large" aria={{ 'aria-label': 'Loading' }} />
    </div>
  );
}

// Fires on every route change (pathname or query string), covering both the
// public site and /admin — logged in-the-clear with the visitor's role when
// known, so the analytics dashboard can filter staff out by default rather
// than never recording their visits at all.
function PageviewTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);
  return null;
}

// Resets scroll position to the top on every route change — React Router
// doesn't do this on its own, so navigating via a link (the footer links in
// particular, reachable from the bottom of a long page) otherwise lands on
// the new page already scrolled down to wherever the old page left off.
// Keyed on pathname only, not search params, so an in-page tab switch (e.g.
// SearchPage's ?tab=) doesn't fight a user's own scrolling.
function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AvatarNudgeProvider>
        <PageviewTracker />
        <ScrollToTop />
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="show/:artist/:date/:locationSlug" element={<ShowDetailPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="posters" element={<PostersPage />} />
            <Route path="discography" element={<DiscographyPage />} />
            <Route path="band" element={<BandPage />} />
            <Route path="band/:slug" element={<BandMemberPage />} />
            <Route path="artwork/:id" element={<ArtworkPage />} />
            <Route path="photos" element={<PhotosPage />} />
            <Route path="links" element={<LinksPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="tour-stats" element={<TourStatsPage />} />
            <Route path="upcoming-shows" element={<UpcomingShowsPage />} />
            <Route path="past-shows" element={<PastShowsPage />} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="how-to-use" element={<HowToUsePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
            {/* Static "edit" segment ranks above the dynamic :username in React
                Router's matcher regardless of declaration order, so a user whose
                username happened to be literally "edit" would have an unreachable
                profile at this URL — acceptable edge case since usernames are
                currently auto-generated, not user-chosen. */}
            <Route path="profile/edit" element={<EditProfilePage />} />
            <Route path="profile/social-card" element={<SocialCardPage />} />
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
            <Route path="tours/:tourName/stats-post" element={<TourStatsPostPage />} />
            <Route path="setlist-submissions" element={<SetlistSubmissionsReview />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="settings" element={<SiteSettingsPage />} />
          </Route>
        </Routes>
        </Suspense>
        </AvatarNudgeProvider>
      </Router>
    </AuthProvider>
  )
}

// These render on every page load until /api/settings returns, so keep them
// matching the live site settings, or visitors see the old text flash and swap.
const DEFAULT_HEADER_TITLE = 'SKYSETS.ORG';
const DEFAULT_HEADER_SUBTITLE = 'A TURTLEHEAD ARCHIVE';
const DEFAULT_FOOTER_LINKS = [
  { text: 'Inspired by crowesbase (RIP Boa)', url: null },
  { text: "Caleb Lewis's Where the Sweet Melody Falls", url: 'https://wherethesweetmelodyfalls.blogspot.com/' },
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
  // DEFAULT_BANNER (not null) for the same reason headerTitle/footerLinks
  // above default to their own common-case values: starting at null meant
  // the banner rendered with zero height until the settings fetch resolved,
  // then popped in and pushed every element below it (nav tabs, the whole
  // homepage) down — the single largest layout-shift contributor measured
  // in Lighthouse/PageSpeed on this site. The admin-configured banner (if
  // different from the default) still overwrites this once the fetch
  // resolves; it just starts from a same-shaped guess instead of nothing.
  const [banner, setBanner] = useState(DEFAULT_BANNER);

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
        if (data.banner) setBanner(data.banner);
      })
      .catch(err => {
        console.error('[PublicLayout] Error loading site settings:', err);
        // Total fetch failure — fall back to the standing default rather
        // than leaving the banner area permanently blank.
        setBanner(DEFAULT_BANNER);
      });
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
    <SiteSettingsProvider headerTitle={headerTitle} headerSubtitle={headerSubtitle}>
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
            <img src="/logo.png" alt="" width="192" height="150" className="h-12 w-auto shrink-0" />
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
                <Suspense fallback={<div className="h-8 w-8" />}>
                  <NotificationBell />
                </Suspense>
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

      <AnnouncementBanner banner={banner} />

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer — full-bleed */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              ['/links', 'Links'],
              ['/band', 'Band'],
              ['/discography', 'Discography'],
              ['/faq', 'FAQ'],
              ['/how-to-use', 'How to Use'],
              ['/about', 'About'],
              ['/privacy', 'Privacy'],
              ['/terms', 'Terms'],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className="text-xs hover:opacity-80 transition-opacity"
                style={{ color: 'var(--p-color-info)' }}
              >
                {label}
              </Link>
            ))}
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
          <div className="text-center text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
            Open source under ISC license. Contributions, issues, and pull requests are welcome.{' '}
            <a
              href="https://github.com/dlevy/BlueskiesBase"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity underline underline-offset-2"
              style={{ color: 'var(--p-color-contrast-medium)' }}
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
    </SiteSettingsProvider>
  );
}

export default App
