import { Link, useLocation, useSearchParams } from 'react-router-dom';

// Search/Stats/My Shows are views within SearchPage (switched via ?tab=), while Posters
// and Photos are real separate routes — but all five render as one consistent tab row
// regardless of which page you're actually on, so switching between them feels like one
// navigation surface rather than "tabs on this page" plus separate pages bolted on.
const TABS = [
    { id: 'search', label: 'Search', to: '/' },
    { id: 'stats', label: 'Stats', to: '/?tab=stats' },
    { id: 'myshows', label: 'My Shows', to: '/?tab=myshows' },
    { id: 'posters', label: 'Posters', to: '/posters' },
    { id: 'photos', label: 'Photos', to: '/photos' },
    { id: 'links', label: 'Links', to: '/links' },
    { id: 'members', label: 'Members', to: '/members' },
];

const ROUTE_TAB = { '/posters': 'posters', '/photos': 'photos', '/links': 'links', '/members': 'members' };

export default function MainNavTabs() {
    const location = useLocation();
    const [urlParams] = useSearchParams();
    const activeTab = ROUTE_TAB[location.pathname] || urlParams.get('tab') || 'search';

    return (
        // Horizontally scrollable — same treatment as AdminLayout's nav — so
        // seven tabs on a narrow phone screen scroll/slide sideways instead of
        // wrapping to a second line and pushing the rest of the page down.
        <div className="border-b border-white/[0.07] mb-6 overflow-x-auto">
            <div className="flex flex-nowrap w-max min-w-full">
                {TABS.map(({ id, label, to }) => {
                    const isActive = activeTab === id;
                    return (
                        <Link
                            key={id}
                            to={to}
                            className={`h-9 px-4 flex items-center text-sm font-medium transition-colors -mb-px border-b-2 shrink-0 ${
                                isActive ? 'border-amber-400 text-amber-300' : 'border-transparent'
                            }`}
                            style={{ color: isActive ? undefined : 'var(--p-color-contrast-medium)' }}
                        >
                            {label}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
