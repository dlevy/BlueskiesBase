import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    PHeading, PText, PButtonPure, PSpinner, PInlineNotification, PTabsBar, PDivider, PTag
} from '@porsche-design-system/components-react';
import { buildShowPath } from '../utils/showSlug';
import { getUserStats } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';

const TABS = ['shows', 'upcoming', 'seen', 'notSeen'];

export default function StatsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [urlParams, setUrlParams] = useSearchParams();
    const activeTab = urlParams.get('tab') || 'shows';
    const activeTabIndex = Math.max(0, TABS.indexOf(activeTab));

    const setActiveTab = (tab) => setUrlParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
    });

    useEffect(() => {
        if (!user) { navigate('/member-login'); return; }

        const fetchStats = async (retryCount = 0) => {
            try {
                setLoading(true);
                setError(null);
                const data = await getUserStats();
                setStats(data);
            } catch (err) {
                console.error('[StatsPage] Error fetching stats:', err);
                if (retryCount === 0 && (err.message.includes('timeout') || err.message.includes('fetch'))) {
                    setTimeout(() => fetchStats(1), 1000);
                    return;
                }
                setError(err.message || 'Failed to load statistics. Please try refreshing the page.');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user, navigate]);

    const formatDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        return new Date(year, month - 1, day).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="px-4 py-8 max-w-6xl mx-auto flex flex-col items-center gap-4">
                <PSpinner size="large" aria={{ 'aria-label': 'Loading statistics' }} />
                <PText color="contrast-medium">Loading your statistics…</PText>
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-4 py-8 max-w-6xl mx-auto space-y-4">
                <PInlineNotification heading="Failed to load stats" description={error} state="error" dismissButton={false} />
                <PButtonPure icon="arrow-left" onClick={() => navigate('/')}>Back to Home</PButtonPure>
            </div>
        );
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isUpcoming = (d) => { const [y, m, day] = d.split('-'); return new Date(y, m - 1, day) >= today; };
    const upcomingShows = stats.attendedShows.filter(s => isUpcoming(s.show_date)).sort((a, b) => a.show_date.localeCompare(b.show_date));
    const pastShows = stats.attendedShows.filter(s => !isUpcoming(s.show_date)).sort((a, b) => b.show_date.localeCompare(a.show_date));

    return (
        <div className="px-4 py-8 max-w-6xl mx-auto space-y-8">
            <SEO
                title="My Concert Stats"
                description="Track your personal Sturgill Simpson and Johnny Blue Skies concert history."
            />

            <div>
                <PHeading size="2xl" tag="h1">My Concert Statistics</PHeading>
                <PText color="contrast-medium">Track your Johnny Blue Skies concert journey</PText>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { value: pastShows.length, label: 'Shows Attended' },
                    { value: upcomingShows.length, label: 'Upcoming Shows' },
                    { value: stats.totalSongsSeen, label: 'Songs Seen Live' },
                    { value: stats.totalSongsNotSeen, label: 'Songs Not Yet Seen' },
                ].map(({ value, label }) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 text-center">
                        <PHeading size="4xl" tag="p">{value}</PHeading>
                        <PText size="sm" color="contrast-medium">{label}</PText>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <PTabsBar
                activeTabIndex={activeTabIndex}
                onUpdate={(e) => setActiveTab(TABS[e.detail.activeTabIndex])}
            >
                <button>Past Shows ({pastShows.length})</button>
                <button>Upcoming ({upcomingShows.length})</button>
                <button>Songs Seen ({stats.totalSongsSeen})</button>
                <button>Not Seen ({stats.totalSongsNotSeen})</button>
            </PTabsBar>

            {/* Tab Content */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-8">
                {activeTab === 'shows' && (
                    <div>
                        <PHeading size="lg" tag="h2">Shows Attended</PHeading>
                        <div className="mt-4 mb-6"><PDivider /></div>
                        {pastShows.length === 0 ? (
                            <PText color="contrast-medium">You haven't marked any shows as attended yet.</PText>
                        ) : (
                            <div className="space-y-2">
                                {pastShows.map((show) => (
                                    <Link
                                        key={show.id}
                                        to={buildShowPath(show)}
                                        className="block rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-all"
                                    >
                                        <PText weight="semi-bold">{formatDate(show.show_date)}</PText>
                                        <PText size="sm" color="contrast-medium">{show.artist_name}</PText>
                                        {show.venues && (
                                            <PText size="xs" color="contrast-low">
                                                {show.venues.name} · {show.venues.city}, {show.venues.state_country}
                                            </PText>
                                        )}
                                        {show.tour_name && (
                                            <PText size="xs" color="contrast-low">{show.tour_name}</PText>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'upcoming' && (
                    <div>
                        <PHeading size="lg" tag="h2">Upcoming Shows</PHeading>
                        <div className="mt-4 mb-6"><PDivider /></div>
                        {upcomingShows.length === 0 ? (
                            <PText color="contrast-medium">No upcoming shows marked yet. Find a show and click "Mark as Attending"!</PText>
                        ) : (
                            <div className="space-y-2">
                                {upcomingShows.map((show) => (
                                    <Link
                                        key={show.id}
                                        to={buildShowPath(show)}
                                        className="block rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-all"
                                    >
                                        <PText weight="semi-bold">{formatDate(show.show_date)}</PText>
                                        <PText size="sm" color="contrast-medium">{show.artist_name}</PText>
                                        {show.venues && (
                                            <PText size="xs" color="contrast-low">
                                                {show.venues.name} · {show.venues.city}, {show.venues.state_country}
                                            </PText>
                                        )}
                                        {show.tour_name && (
                                            <PText size="xs" color="contrast-low">{show.tour_name}</PText>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'seen' && (
                    <div>
                        <PHeading size="lg" tag="h2">Songs You've Seen Live</PHeading>
                        <div className="mt-4 mb-6"><PDivider /></div>
                        {stats.songsSeen.length === 0 ? (
                            <PText color="contrast-medium">No songs yet. Mark some shows as attended!</PText>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {stats.songsSeen
                                    .sort((a, b) => b.playCount - a.playCount)
                                    .map((song) => (
                                        <div key={song.id} className="flex justify-between items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <PText weight="semi-bold">{song.title}</PText>
                                                {!song.is_original && song.original_artist && (
                                                    <PText size="xs" color="contrast-medium">· {song.original_artist}</PText>
                                                )}
                                                {!song.is_original && (
                                                    <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-700 whitespace-nowrap">Cover</span>
                                                )}
                                            </div>
                                            <PTag color="notification-success-soft">{song.playCount}x</PTag>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'notSeen' && (
                    <div>
                        <PHeading size="lg" tag="h2">Songs You Haven't Seen Yet</PHeading>
                        <div className="mt-4 mb-6"><PDivider /></div>
                        {stats.songsNotSeen.length === 0 ? (
                            <div className="text-center py-8">
                                <PHeading size="xl" tag="p">Congratulations!</PHeading>
                                <PText color="contrast-medium">You've seen all the songs!</PText>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {stats.songsNotSeen
                                    .sort((a, b) => {
                                        if (!a.mostRecentShow || !b.mostRecentShow) return 0;
                                        return b.mostRecentShow.show_date.localeCompare(a.mostRecentShow.show_date);
                                    })
                                    .map((song) => (
                                        <div key={song.id} className="rounded-xl border border-white/5 bg-white/5 p-4">
                                            <PText weight="semi-bold">{song.title}</PText>
                                            {!song.is_original && song.original_artist && (
                                                <PText size="xs" color="contrast-medium">Cover · {song.original_artist}</PText>
                                            )}
                                            {song.mostRecentShow && (
                                                <div className="mt-2">
                                                    <PText size="xs" color="contrast-low">Last played:</PText>
                                                    <Link
                                                        to={buildShowPath(song.mostRecentShow)}
                                                        className="text-xs text-[var(--p-color-info)] hover:opacity-80 transition-opacity"
                                                    >
                                                        {formatDate(song.mostRecentShow.show_date)}
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
