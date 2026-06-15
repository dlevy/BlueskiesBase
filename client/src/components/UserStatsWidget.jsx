import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    PHeading, PText, PButton, PSpinner, PInlineNotification, PDivider
} from '@porsche-design-system/components-react';
import { useCountUp } from '../hooks/useCountUp';
import { buildShowPath } from '../utils/showSlug';
import { getUserStats } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ShowMapShare from './ShowMapShare';

function StatCard({ value, label }) {
    const count = useCountUp(value);
    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 text-center">
            <div className="font-display font-bold text-5xl leading-none mb-2 text-amber-400">{count}</div>
            <PText size="sm" color="contrast-medium" align="center">{label}</PText>
        </div>
    );
}

const TABS = ['shows', 'upcoming', 'seen', 'notSeen'];

export default function UserStatsWidget() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [urlParams, setUrlParams] = useSearchParams();
    const activeTab = urlParams.get('statsTab') || 'shows';
    const activeTabIndex = Math.max(0, TABS.indexOf(activeTab));

    const setActiveTab = (tab) => setUrlParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('statsTab', tab);
        return next;
    });

    useEffect(() => {
        if (!user) { setLoading(false); return; }

        const fetchStats = async (retryCount = 0) => {
            try {
                setLoading(true);
                setError(null);
                const data = await getUserStats();
                setStats(data);
            } catch (err) {
                console.error('[UserStatsWidget] Error fetching stats:', err);
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
    }, [user]);

    const formatDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        return new Date(year, month - 1, day).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    const formatDateLong = (dateString) => {
        const [year, month, day] = dateString.split('-');
        return new Date(year, month - 1, day).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    if (!user) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-8 text-center space-y-4">
                <PText color="contrast-medium">
                    You must be logged in and have marked at least one concert as attended to view your stats.
                </PText>
                <Link to="/member-login">
                    <PButton>Log In</PButton>
                </Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-8 flex flex-col items-center gap-4">
                <PSpinner size="large" aria={{ 'aria-label': 'Loading your statistics' }} />
                <PText color="contrast-medium">Loading your statistics…</PText>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6">
                <PInlineNotification heading="Failed to load stats" description={error} state="error" dismissButton={false} />
            </div>
        );
    }

    if (!stats) return null;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isUpcoming = (d) => { const [y, m, day] = d.split('-'); return new Date(y, m - 1, day) >= today; };
    const upcomingShows = stats.attendedShows.filter(s => isUpcoming(s.show_date)).sort((a, b) => a.show_date.localeCompare(b.show_date));
    const pastShows = stats.attendedShows.filter(s => !isUpcoming(s.show_date)).sort((a, b) => b.show_date.localeCompare(a.show_date));

    if (stats.attendedShows.length === 0) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-8 text-center space-y-2">
                <PText>You haven't marked any shows yet.</PText>
                <PText size="sm" color="contrast-medium">
                    Browse shows and click "Mark as Attended" to start tracking!
                </PText>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <PHeading size="xs" tag="h2">My Stats</PHeading>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard value={pastShows.length} label="Shows Attended" />
                <StatCard value={upcomingShows.length} label="Upcoming Shows" />
                <StatCard value={stats.songsSeen.length} label="Songs Seen Live" />
                <StatCard value={stats.songsNotSeen.length} label="Songs Not Seen Yet" />
            </div>

            {/* Show Map */}
            <ShowMapShare pastShows={pastShows} upcomingShows={upcomingShows} />

            {/* Tab Navigation */}
            <div className="flex flex-wrap border-b border-white/[0.07]">
                {[
                    ['shows', `Past Shows (${pastShows.length})`],
                    ['upcoming', `Upcoming (${upcomingShows.length})`],
                    ['seen', `Songs Seen (${stats.songsSeen.length})`],
                    ['notSeen', `Not Seen Yet (${stats.songsNotSeen.length})`],
                ].map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`h-9 px-4 text-sm font-medium transition-colors -mb-px border-b-2 whitespace-nowrap ${
                            activeTab === id ? 'border-amber-400 text-amber-300' : 'border-transparent'
                        }`}
                        style={{ color: activeTab === id ? undefined : 'var(--p-color-contrast-medium)' }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6">
                {activeTab === 'shows' && (
                    <div>
                        <PHeading size="md" tag="h3">Shows Attended</PHeading>
                        <div className="mt-4">
                            <PDivider />
                        </div>
                        {pastShows.length === 0 ? (
                            <PText color="contrast-medium" className="mt-4">No past shows yet.</PText>
                        ) : (
                            <div className="space-y-2 mt-4">
                                {pastShows.map((show) => (
                                    <Link
                                        key={show.id}
                                        to={buildShowPath(show)}
                                        className="block rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-all"
                                    >
                                        <PText weight="semi-bold">{formatDateLong(show.show_date)}</PText>
                                        <PText size="sm" color="contrast-medium">{show.artist_name}</PText>
                                        {show.venues && (
                                            <PText size="xs" color="contrast-low">
                                                {show.venues.name} · {show.venues.city}, {show.venues.state_country}
                                            </PText>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'upcoming' && (
                    <div>
                        <PHeading size="md" tag="h3">Upcoming Shows</PHeading>
                        <div className="mt-4"><PDivider /></div>
                        {upcomingShows.length === 0 ? (
                            <PText color="contrast-medium" className="mt-4">No upcoming shows marked yet.</PText>
                        ) : (
                            <div className="space-y-2 mt-4">
                                {upcomingShows.map((show) => (
                                    <Link
                                        key={show.id}
                                        to={buildShowPath(show)}
                                        className="block rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-all"
                                    >
                                        <PText weight="semi-bold">{formatDateLong(show.show_date)}</PText>
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
                        <PHeading size="md" tag="h3">Songs You've Seen Live</PHeading>
                        <div className="mt-4"><PDivider /></div>
                        {stats.songsSeen.length === 0 ? (
                            <PText color="contrast-medium" className="mt-4">No songs tracked yet.</PText>
                        ) : (
                            <div className="space-y-1 mt-4">
                                {stats.songsSeen
                                    .sort((a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title))
                                    .map((song) => (
                                        <div
                                            key={song.id}
                                            className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <PText weight="semi-bold">{song.title}</PText>
                                                {!song.is_original && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 whitespace-nowrap">Cover</span>
                                                )}
                                            </div>
                                            <PText size="xs" color="contrast-medium" className="whitespace-nowrap shrink-0">
                                                {song.playCount}x
                                            </PText>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'notSeen' && (
                    <div>
                        <PHeading size="md" tag="h3">Songs You Haven't Seen Yet</PHeading>
                        <div className="mt-4"><PDivider /></div>
                        {stats.songsNotSeen.length === 0 ? (
                            <div className="text-center py-8">
                                <PHeading size="lg" tag="p">You've seen all the songs!</PHeading>
                            </div>
                        ) : (
                            <div className="space-y-1 mt-4">
                                {stats.songsNotSeen
                                    .sort((a, b) => a.title.localeCompare(b.title))
                                    .map((song) => (
                                        <div
                                            key={song.id}
                                            className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <PText weight="semi-bold">{song.title}</PText>
                                                {!song.is_original && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 whitespace-nowrap">Cover</span>
                                                )}
                                            </div>
                                            {song.mostRecentShow && (
                                                <Link
                                                    to={buildShowPath(song.mostRecentShow)}
                                                    className="text-xs text-[var(--p-color-info)] hover:opacity-80 transition-opacity whitespace-nowrap shrink-0"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    Last: {formatDate(song.mostRecentShow.show_date)}
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <PText size="xs" color="contrast-low" align="center">
                Data as of {formatDate(new Date().toISOString().split('T')[0])}
            </PText>
        </div>
    );
}
