import { Link, useLocation, useSearchParams } from 'react-router-dom';

function HomeIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 576 512" fill="currentColor">
            <path d="M280.37 148.26L96 300.11V464a16 16 0 0 0 16 16l112.06-.29a16 16 0 0 0 15.92-16V368a16 16 0 0 1 16-16h64a16 16 0 0 1 16 16v95.64a16 16 0 0 0 16 16.05L464 480a16 16 0 0 0 16-16V300L295.67 148.26a12.19 12.19 0 0 0-15.3 0zM571.6 251.47L488 182.56V44.05a12 12 0 0 0-12-12h-56a12 12 0 0 0-12 12v72.61L318.47 43a48 48 0 0 0-61 0L4.34 251.47a12 12 0 0 0-1.6 16.9l25.5 31A12 12 0 0 0 45.15 301l235.22-193.74a12.19 12.19 0 0 1 15.3 0L530.9 301a12 12 0 0 0 16.9-1.6l25.5-31a12 12 0 0 0-1.7-16.93z" />
        </svg>
    );
}

// Search/Stats/My Shows are views within SearchPage (switched via ?tab=), while Posters
// and Photos are real separate routes — but all five render as one consistent tab row
// regardless of which page you're actually on, so switching between them feels like one
// navigation surface rather than "tabs on this page" plus separate pages bolted on.
// The first tab (still id 'search' for the activeTab logic below, since it's
// still the Search/homepage view) renders as an icon-only home button to
// save horizontal space — the rest stay as text.
const TABS = [
    { id: 'search', label: 'Home', to: '/', icon: true },
    { id: 'stats', label: 'Stats', to: '/?tab=stats' },
    { id: 'myshows', label: 'My Shows', to: '/?tab=myshows' },
    { id: 'posters', label: 'Posters', to: '/posters' },
    { id: 'photos', label: 'Photos', to: '/photos' },
    { id: 'members', label: 'Members', to: '/members' },
];

const ROUTE_TAB = { '/posters': 'posters', '/photos': 'photos', '/members': 'members' };

// `onHomeClick` is optional — only SearchPage (the one place with filters to
// reset) passes it. Other pages render MainNavTabs with it omitted, so the
// home icon there just navigates normally via the Link.
export default function MainNavTabs({ onHomeClick } = {}) {
    const location = useLocation();
    const [urlParams] = useSearchParams();
    // Falls back to 'search' only on the homepage itself (no ?tab param there
    // still means the Search view) — any other unmatched route (e.g. a show
    // detail page) gets no active tab at all, rather than misleadingly
    // highlighting Search.
    const activeTab = ROUTE_TAB[location.pathname] || urlParams.get('tab') || (location.pathname === '/' ? 'search' : null);

    return (
        // Sticky right below the logo header (top-14 = the header's own h-14),
        // same "frozen while scrolling" treatment as the header itself — needs
        // its own opaque/blurred background since once stuck, page content
        // scrolls underneath it. Horizontally scrollable — same treatment as
        // AdminLayout's nav — so seven tabs on a narrow phone screen
        // scroll/slide sideways instead of wrapping to a second line and
        // pushing the rest of the page down. overflow-y-hidden is deliberate:
        // setting only overflow-x makes browsers treat overflow-y as auto too,
        // so a sub-pixel vertical overflow (from the active tab's border
        // trick) was popping a stray vertical scrollbar on the right edge.
        <div
            className="sticky top-14 z-40 border-b border-white/[0.07] mb-6 overflow-x-auto overflow-y-hidden"
            style={{
                background: 'color-mix(in srgb, var(--p-color-canvas) 88%, transparent)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            }}
        >
            <div className="flex flex-nowrap w-max min-w-full">
                {TABS.map(({ id, label, to, icon }) => {
                    const isActive = activeTab === id;
                    return (
                        <Link
                            key={id}
                            to={to}
                            onClick={icon ? onHomeClick : undefined}
                            title={icon ? label : undefined}
                            aria-label={icon ? label : undefined}
                            className={`h-9 ${icon ? 'px-3' : 'px-4'} flex items-center text-sm font-medium transition-colors -mb-px border-b-2 shrink-0 ${
                                isActive ? 'border-amber-400 text-amber-300' : 'border-transparent'
                            }`}
                            style={{ color: isActive ? undefined : 'var(--p-color-contrast-medium)' }}
                        >
                            {icon ? <HomeIcon /> : label}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
