import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    PHeading, PText, PButtonPure, PSpinner, PInlineNotification, PDivider, PTag
} from '@porsche-design-system/components-react';
import { useCountUp } from '../hooks/useCountUp';
import { buildShowPath } from '../utils/showSlug';
import { getUserStats } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';

function StatCard({ value, label }) {
    const count = useCountUp(value);
    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 text-center">
            <div className="font-display font-bold text-5xl leading-none mb-2 text-amber-400">{count}</div>
            <PText size="sm" color="contrast-medium">{label}</PText>
        </div>
    );
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function computeFunStats(pastShows, songsSeen) {
    if (!pastShows.length) return null;
    const sorted = [...pastShows].sort((a, b) => a.show_date.localeCompare(b.show_date));

    const cityCounts  = {};
    const venueCounts = {};
    const monthCounts = {};
    const dowCounts   = {};
    const yearCounts  = {};
    const cities   = new Set();
    const regions  = new Set();

    for (const show of pastShows) {
        const [y, m, d] = show.show_date.split('-');
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        const city      = show.venues?.city  || 'Unknown';
        const venueName = show.venues?.name  || 'Unknown';
        const venueKey  = `${venueName}||${city}`;
        const month = MONTHS[date.getMonth()];
        const dow   = DAYS[date.getDay()];

        cityCounts[city] = (cityCounts[city] || 0) + 1;
        if (!venueCounts[venueKey]) venueCounts[venueKey] = { name: venueName, city, count: 0 };
        venueCounts[venueKey].count++;
        monthCounts[month] = (monthCounts[month] || 0) + 1;
        dowCounts[dow]     = (dowCounts[dow]     || 0) + 1;
        yearCounts[y]      = (yearCounts[y]       || 0) + 1;
        cities.add(city);
        if (show.venues?.state_country) regions.add(show.venues.state_country);
    }

    const topCity  = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0];
    const topVenue = Object.values(venueCounts).sort((a, b) => b.count - a.count)[0];
    const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
    const topDow   = Object.entries(dowCounts).sort((a, b)   => b[1] - a[1])[0];
    const topSong  = songsSeen?.length
        ? [...songsSeen].sort((a, b) => b.playCount - a.playCount)[0]
        : null;

    const yearRows = Object.entries(yearCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, count]) => ({ year, count }));
    const maxYearCount = Math.max(...yearRows.map(r => r.count));

    return {
        firstShow: sorted[0],
        topCity:   topCity  ? { name: topCity[0],  count: topCity[1]  } : null,
        topVenue,
        topMonth:  topMonth ? { name: topMonth[0], count: topMonth[1] } : null,
        topDow:    topDow   ? { name: topDow[0],   count: topDow[1]   } : null,
        topSong,
        uniqueCities:  cities.size,
        uniqueRegions: regions.size,
        yearRows,
        maxYearCount,
    };
}

function FactCard({ label, value, sub }) {
    return (
        <div className="rounded-xl border border-white/10 bg-[#1a1e26] px-4 py-3 space-y-0.5">
            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</PText>
            <div className="text-sm font-semibold" style={{ color: 'var(--p-color-primary)' }}>{value}</div>
            {sub && <PText size="xs" color="contrast-medium">{sub}</PText>}
        </div>
    );
}

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
    const funStats = computeFunStats(pastShows, stats.songsSeen);

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
                <StatCard value={pastShows.length} label="Shows Attended" />
                <StatCard value={upcomingShows.length} label="Upcoming Shows" />
                <StatCard value={stats.totalSongsSeen} label="Songs Seen Live" />
                <StatCard value={stats.totalSongsNotSeen} label="Songs Not Yet Seen" />
            </div>

            {/* Fun Stats */}
            {funStats && (
                <div className="space-y-4">
                    <PHeading size="md" tag="h2">By the Numbers</PHeading>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {funStats.firstShow && (
                            <FactCard
                                label="First Show"
                                value={formatDate(funStats.firstShow.show_date)}
                                sub={funStats.firstShow.venues ? `${funStats.firstShow.venues.name}, ${funStats.firstShow.venues.city}` : undefined}
                            />
                        )}
                        {funStats.topCity && (
                            <FactCard
                                label="Favorite City"
                                value={funStats.topCity.name}
                                sub={`${funStats.topCity.count} show${funStats.topCity.count !== 1 ? 's' : ''}`}
                            />
                        )}
                        {funStats.topVenue && (
                            <FactCard
                                label="Top Venue"
                                value={funStats.topVenue.name}
                                sub={`${funStats.topVenue.city} · ${funStats.topVenue.count}x`}
                            />
                        )}
                        {funStats.uniqueCities > 0 && (
                            <FactCard
                                label="Cities Visited"
                                value={`${funStats.uniqueCities} cities`}
                                sub={`across ${funStats.uniqueRegions} state${funStats.uniqueRegions !== 1 ? 's' : ''} & countries`}
                            />
                        )}
                        {funStats.topMonth && (
                            <FactCard
                                label="Favorite Month"
                                value={funStats.topMonth.name}
                                sub={`${funStats.topMonth.count} show${funStats.topMonth.count !== 1 ? 's' : ''} in ${funStats.topMonth.name}`}
                            />
                        )}
                        {funStats.topDow && (
                            <FactCard
                                label="Favorite Day"
                                value={`${funStats.topDow.name}s`}
                                sub={`${funStats.topDow.count} show${funStats.topDow.count !== 1 ? 's' : ''} on a ${funStats.topDow.name}`}
                            />
                        )}
                        {funStats.topSong && (
                            <FactCard
                                label="Most-Played Song"
                                value={funStats.topSong.title}
                                sub={`Seen live ${funStats.topSong.playCount}x`}
                            />
                        )}
                        {stats.totalSongsSeen > 0 && stats.totalSongsNotSeen >= 0 && (
                            <FactCard
                                label="Song Completion"
                                value={`${Math.round(stats.totalSongsSeen / (stats.totalSongsSeen + stats.totalSongsNotSeen) * 100)}%`}
                                sub={`${stats.totalSongsSeen} of ${stats.totalSongsSeen + stats.totalSongsNotSeen} songs`}
                            />
                        )}
                    </div>

                    {/* Shows by Year */}
                    {funStats.yearRows.length > 1 && (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 space-y-3">
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shows by Year</PText>
                            <div className="space-y-2">
                                {funStats.yearRows.map(({ year, count }) => (
                                    <div key={year} className="flex items-center gap-3">
                                        <span className="text-xs w-10 shrink-0 text-right" style={{ color: 'var(--p-color-contrast-medium)' }}>{year}</span>
                                        <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden">
                                            <div
                                                className="h-full rounded bg-amber-400/80 transition-all duration-700"
                                                style={{ width: `${(count / funStats.maxYearCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs w-4 shrink-0" style={{ color: 'var(--p-color-contrast-medium)' }}>{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap border-b border-white/[0.07]">
                {[
                    ['shows', `Past Shows (${pastShows.length})`],
                    ['upcoming', `Upcoming (${upcomingShows.length})`],
                    ['seen', `Songs Seen (${stats.totalSongsSeen})`],
                    ['notSeen', `Not Seen (${stats.totalSongsNotSeen})`],
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
                                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                {show.venues.name} · {show.venues.city}, {show.venues.state_country}
                                            </PText>
                                        )}
                                        {show.tour_name && (
                                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>{show.tour_name}</PText>
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
                                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                {show.venues.name} · {show.venues.city}, {show.venues.state_country}
                                            </PText>
                                        )}
                                        {show.tour_name && (
                                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>{show.tour_name}</PText>
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
                                                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 whitespace-nowrap">Cover</span>
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
                                                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>Last played:</PText>
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
