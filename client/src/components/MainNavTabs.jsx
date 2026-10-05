import { Link, useLocation, useSearchParams } from 'react-router-dom';

function HomeIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7m-7-7v18m-7-9v9a1 1 0 001 1h3m10-10l2 2m-2-2v9a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
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
