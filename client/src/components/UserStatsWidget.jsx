import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    PHeading, PText, PButton, PSpinner, PInlineNotification
} from '@porsche-design-system/components-react';
import { useCountUp } from '../hooks/useCountUp';
import { buildShowPath } from '../utils/showSlug';
import { getUserStats } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ShowMapShare from './ShowMapShare';
import AchievementsPanel from './AchievementsPanel';
import FactCard from './FactCard';

function StatCard({ value, label }) {
    const count = useCountUp(value);
    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 text-center">
            <div className="font-display font-bold text-5xl leading-none mb-2 text-amber-400">{count}</div>
            <PText size="sm" color="contrast-medium" align="center">{label}</PText>
        </div>
    );
}

// Non-linking attendee pills for a show row — the whole row is itself a Link to the
// show page, so these can't be Links too (no nested <a> tags).
function AttendeePills({ attendees }) {
    if (!attendees || attendees.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {attendees.slice(0, 6).map((a, i) => (
                <span
                    key={a.id || i}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-white/10 bg-white/5"
                    style={{ color: 'var(--p-color-contrast-medium)' }}
                >
                    {a.displayName || a.username || 'Private'}
                </span>
            ))}
            {attendees.length > 6 && (
                <span className="text-[11px]" style={{ color: 'var(--p-color-contrast-low)' }}>
                    +{attendees.length - 6} more
                </span>
            )}
        </div>
    );
}

export default function UserStatsWidget() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [urlParams, setUrlParams] = useSearchParams();
    const activeTab = urlParams.get('statsTab') || 'shows';

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
    const attendeesByShow = stats.attendeesByShow || {};

    // % of the whole catalog witnessed live, split originals vs covers — songsSeen and
    // songsNotSeen together cover every song ever played by anyone, so no extra fetch
    // is needed to know the full catalog size.
    const isCover = (s) => s.is_original === false;
    const originalsSeen = stats.songsSeen.filter(s => !isCover(s)).length;
    const coversSeen = stats.songsSeen.filter(isCover).length;
    const totalOriginals = originalsSeen + stats.songsNotSeen.filter(s => !isCover(s)).length;
    const totalCovers = coversSeen + stats.songsNotSeen.filter(isCover).length;
    const originalsPct = totalOriginals > 0 ? Math.round((originalsSeen / totalOriginals) * 100) : 0;
    const coversPct = totalCovers > 0 ? Math.round((coversSeen / totalCovers) * 100) : 0;

    // Fan Facts — server-computed by the shared computeFunStats util (same one the
    // public profile page uses), so "first show"/"top venue"/"top song" stay in
    // lockstep with that definition instead of a second, possibly-diverging version.
    const funStats = stats.funStats;
    const firstShowYearsAgo = funStats ? today.getFullYear() - Number(funStats.firstShow.show_date.slice(0, 4)) : null;

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

            {/* Achievements */}
            <AchievementsPanel showCount={pastShows.length} contributionCount={stats.contributionCounts?.total ?? 0} />

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard value={pastShows.length} label="Shows Attended" />
                <StatCard value={upcomingShows.length} label="Upcoming Shows" />
                <StatCard value={stats.songsSeen.length} label="Songs Seen Live" />
                <StatCard value={stats.songsNotSeen.length} label="Songs Not Seen Yet" />
            </div>

            {/* Fan Facts */}
            {funStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FactCard
                        label="First Live Show"
                        value={formatDate(funStats.firstShow.show_date)}
                        sub={firstShowYearsAgo > 0 ? `${firstShowYearsAgo} year${firstShowYearsAgo === 1 ? '' : 's'} ago` : 'This year'}
                    />
                    {funStats.topVenue && (
                        <FactCard
                            label="Most-Seen Venue"
                            value={funStats.topVenue.name}
                            sub={`${funStats.topVenue.count} show${funStats.topVenue.count === 1 ? '' : 's'} · ${funStats.topVenue.city}`}
                        />
                    )}
                </div>
            )}

            {/* Show Map */}
            <ShowMapShare pastShows={pastShows} upcomingShows={upcomingShows} />

            {/* Tabs + content, merged into one container */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] overflow-hidden">
                <div className="flex flex-wrap gap-2 p-4 border-b border-white/[0.07]">
                    {[
                        ['shows', `Past Shows (${pastShows.length})`],
                        ['upcoming', `Upcoming (${upcomingShows.length})`],
                        ['originals', `Originals Seen (${originalsPct}%)`],
                        ['covers', `Covers Seen (${coversPct}%)`],
                        ['debuts', `Live Debuts (${stats.liveDebutsWitnessed ?? 0})`],
                        ['notSeen', `Not Seen Yet (${stats.songsNotSeen.length})`],
                    ].map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className="h-9 px-4 rounded-full text-sm font-semibold transition-colors whitespace-nowrap"
                            style={activeTab === id
                                ? { background: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }
                                : { background: 'transparent', color: 'var(--p-color-contrast-medium)', border: '1px solid transparent' }
                            }
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {activeTab === 'shows' && (
                        pastShows.length === 0 ? (
                            <PText color="contrast-medium">No past shows yet.</PText>
                        ) : (
                            <div className="space-y-2">
                                {pastShows.map((show) => (
                                    <Link
                                        key={show.id}
                                        to={buildShowPath(show)}
                                        className="block rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-all"
                                    >
                                        <PText weight="semi-bold">{formatDateLong(show.show_date)}</PText>
                                        <PText size="sm" color="contrast-medium">{show.artist_name}</PText>
                                        {show.venues && (
                                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                {show.venues.name} · {show.venues.city}, {show.venues.state_country}
                                            </PText>
                                        )}
                                        <AttendeePills attendees={attendeesByShow[show.id]} />
                                    </Link>
                                ))}
                            </div>
                        )
                    )}

                    {activeTab === 'upcoming' && (
                        upcomingShows.length === 0 ? (
                            <PText color="contrast-medium">No upcoming shows marked yet.</PText>
                        ) : (
                            <div className="space-y-2">
                                {upcomingShows.map((show) => (
                                    <Link
                                        key={show.id}
                                        to={buildShowPath(show)}
                                        className="block rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-all"
                                    >
                                        <PText weight="semi-bold">{formatDateLong(show.show_date)}</PText>
                                        <PText size="sm" color="contrast-medium">{show.artist_name}</PText>
                                        {show.venues && (
                                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                {show.venues.name} · {show.venues.city}, {show.venues.state_country}
                                            </PText>
                                        )}
                                        {show.tour_name && (
                                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>{show.tour_name}</PText>
                                        )}
                                        <AttendeePills attendees={attendeesByShow[show.id]} />
                                    </Link>
                                ))}
                            </div>
                        )
                    )}

                    {activeTab === 'originals' && (
                        originalsSeen === 0 ? (
                            <PText color="contrast-medium">No originals tracked yet.</PText>
                        ) : (
                            <div className="space-y-1">
                                <PText size="sm" color="contrast-medium" className="block mb-2">
                                    {originalsSeen} of {totalOriginals} originals seen ({originalsPct}%)
                                </PText>
                                {stats.songsSeen
                                    .filter(s => !isCover(s))
                                    .sort((a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title))
                                    .map((song) => (
                                        <div
                                            key={song.id}
                                            className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <PText weight="semi-bold">{song.title}</PText>
                                            <PText size="xs" color="contrast-medium" className="whitespace-nowrap shrink-0">
                                                {song.playCount}x
                                            </PText>
                                        </div>
                                    ))}
                            </div>
                        )
                    )}

                    {activeTab === 'covers' && (
                        coversSeen === 0 ? (
                            <PText color="contrast-medium">No covers tracked yet.</PText>
                        ) : (
                            <div className="space-y-1">
                                <PText size="sm" color="contrast-medium" className="block mb-2">
                                    {coversSeen} of {totalCovers} covers seen ({coversPct}%)
                                </PText>
                                {stats.songsSeen
                                    .filter(isCover)
                                    .sort((a, b) => b.playCount - a.playCount || a.title.localeCompare(b.title))
                                    .map((song) => (
                                        <div
                                            key={song.id}
                                            className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <PText weight="semi-bold">{song.title}</PText>
                                            <PText size="xs" color="contrast-medium" className="whitespace-nowrap shrink-0">
                                                {song.playCount}x
                                            </PText>
                                        </div>
                                    ))}
                            </div>
                        )
                    )}

                    {activeTab === 'debuts' && (
                        !stats.liveDebuts || stats.liveDebuts.length === 0 ? (
                            <PText color="contrast-medium">No live debuts witnessed yet.</PText>
                        ) : (
                            <div className="space-y-1">
                                {stats.liveDebuts.map((d) => (
                                    <div
                                        key={`${d.showId}-${d.songId}`}
                                        className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                                    >
                                        <PText weight="semi-bold">{d.title}</PText>
                                        {d.show ? (
                                            <Link
                                                to={buildShowPath(d.show)}
                                                className="text-xs text-[var(--p-color-info)] hover:opacity-80 transition-opacity whitespace-nowrap shrink-0"
                                            >
                                                {formatDate(d.showDate)}
                                            </Link>
                                        ) : (
                                            <PText size="xs" color="contrast-medium" className="whitespace-nowrap shrink-0">
                                                {formatDate(d.showDate)}
                                            </PText>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {activeTab === 'notSeen' && (
                        stats.songsNotSeen.length === 0 ? (
                            <div className="text-center py-8">
                                <PHeading size="lg" tag="p">You've seen all the songs!</PHeading>
                            </div>
                        ) : (
                            <div className="space-y-1">
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
                                                {song.is_sunday_valley && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 whitespace-nowrap">Sunday Valley</span>
                                                )}
                                            </div>
                                            {song.mostRecentShow && (
                                                <Link
                                                    to={buildShowPath(song.mostRecentShow)}
                                                    className="text-xs text-[var(--p-color-info)] hover:opacity-80 transition-opacity whitespace-nowrap shrink-0"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    Last Played: {formatDate(song.mostRecentShow.show_date)}
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )
                    )}
                </div>
            </div>

            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} align="center">
                Data as of {formatDate(new Date().toISOString().split('T')[0])}
            </PText>
        </div>
    );
}
