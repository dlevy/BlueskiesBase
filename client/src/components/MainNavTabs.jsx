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
];

const ROUTE_TAB = { '/posters': 'posters', '/photos': 'photos' };

export default function MainNavTabs() {
    const location = useLocation();
    const [urlParams] = useSearchParams();
    const activeTab = ROUTE_TAB[location.pathname] || urlParams.get('tab') || 'search';

    return (
        <div className="flex border-b border-white/[0.07] mb-6">
            {TABS.map(({ id, label, to }) => {
                const isActive = activeTab === id;
                return (
                    <Link
                        key={id}
                        to={to}
                        className={`h-9 px-4 flex items-center text-sm font-medium transition-colors -mb-px border-b-2 ${
                            isActive ? 'border-amber-400 text-amber-300' : 'border-transparent'
                        }`}
                        style={{ color: isActive ? undefined : 'var(--p-color-contrast-medium)' }}
                    >
                        {label}
                    </Link>
                );
            })}
        </div>
    );
}
