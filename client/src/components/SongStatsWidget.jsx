import { useState, useEffect } from 'react';
import { PHeading, PText, PSpinner, PInlineNotification, PDivider } from '@porsche-design-system/components-react';
import { getGlobalSongStats, getSongs } from '../services/api';
import { supabase } from '../services/supabase';
import { useCountUp } from '../hooks/useCountUp';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const US_STATE_CODES = new Set([
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
    'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR',
]);
const US_STATE_NAMES = new Set([
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
    'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
    'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
    'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
    'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
    'District of Columbia',
]);
const UK_REGIONS = new Set(['UK','England','Scotland','Wales','Northern Ireland']);

function getCountry(state_country) {
    if (!state_country) return null;
    const sc = state_country.trim();
    if (sc.endsWith(', United States'))  return 'USA';
    if (US_STATE_CODES.has(sc))          return 'USA';
    if (US_STATE_NAMES.has(sc))          return 'USA';
    if (sc === 'UK' || UK_REGIONS.has(sc) || sc.endsWith(', United Kingdom')) return 'UK';
    if (sc === 'Ireland' || sc.endsWith(', Ireland')) return 'Ireland';
    if (sc === 'Canada' || sc.includes(', Canada'))   return 'Canada';
    // "Oslo, Norway" / "Hamburg, Germany" / "Ontario, Canada" etc.
    if (sc.includes(',')) return sc.split(',').pop().trim();
    return sc;
}

function FactCard({ label, value, sub }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 space-y-0.5">
            <PText size="xs" color="contrast-low" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</PText>
            <div className="text-sm font-semibold" style={{ color: 'var(--p-color-primary)' }}>{value}</div>
            {sub && <PText size="xs" color="contrast-medium">{sub}</PText>}
        </div>
    );
}

export default function SongStatsWidget() {
    const [stats, setStats] = useState(null);
    const [holyGrails, setHolyGrails] = useState([]);
    const [showStats, setShowStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const statsData = await getGlobalSongStats();
                setStats(statsData);
            } catch (err) {
                console.error('Error fetching song stats:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        const fetchShowStats = async () => {
            try {
                const { data, error: err } = await supabase
                    .from('shows')
                    .select('show_date, venues(city, state_country)');
                if (err) throw err;

                const monthCounts = {};
                const dowCounts   = {};
                const yearCounts  = {};
                const cities      = new Set();
                const countries   = new Set();

                for (const show of data) {
                    const [y, m, d] = show.show_date.split('-');
                    const date  = new Date(Number(y), Number(m) - 1, Number(d));
                    const month = MONTHS[date.getMonth()];
                    const dow   = DAYS[date.getDay()];

                    monthCounts[month] = (monthCounts[month] || 0) + 1;
                    dowCounts[dow]     = (dowCounts[dow]     || 0) + 1;
                    yearCounts[y]      = (yearCounts[y]      || 0) + 1;

                    if (show.venues?.city) cities.add(show.venues.city);
                    const country = getCountry(show.venues?.state_country);
                    if (country) countries.add(country);
                }

                const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
                const topDow   = Object.entries(dowCounts).sort((a, b)   => b[1] - a[1])[0];
                const yearRows = Object.entries(yearCounts)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([year, count]) => ({ year, count }));

                setShowStats({
                    totalShows:      data.length,
                    topMonth:        topMonth ? { name: topMonth[0], count: topMonth[1] } : null,
                    topDow:          topDow   ? { name: topDow[0],   count: topDow[1]   } : null,
                    uniqueCities:    cities.size,
                    uniqueCountries: countries.size,
                    yearRows,
                    maxYearCount:    Math.max(...yearRows.map(r => r.count)),
                });
            } catch (err) {
                console.error('Error fetching show stats:', err);
            }
        };

        const fetchHolyGrails = async () => {
            try {
                const songsData = await getSongs();
                const unplayed = (songsData.songs || []).filter(
                    s => s.is_original === true && s.performance_count === 0
                );

                const albumMap = new Map();
                unplayed.forEach(song => {
                    const assocs = song.album_songs?.filter(as => as.albums) || [];
                    if (assocs.length > 0) {
                        assocs.forEach(as => {
                            const key = as.albums.id;
                            if (!albumMap.has(key)) {
                                albumMap.set(key, {
                                    title: as.albums.title,
                                    releaseDate: as.albums.release_date || '',
                                    songs: [],
                                });
                            }
                            albumMap.get(key).songs.push(song.title);
                        });
                    } else {
                        const key = '__none__';
                        if (!albumMap.has(key)) albumMap.set(key, { title: 'Unreleased', releaseDate: '', songs: [] });
                        albumMap.get(key).songs.push(song.title);
                    }
                });

                setHolyGrails(
                    [...albumMap.values()]
                        .sort((a, b) => {
                            if (!a.releaseDate) return 1;
                            if (!b.releaseDate) return -1;
                            return b.releaseDate.localeCompare(a.releaseDate);
                        })
                        .map(album => ({ ...album, songs: album.songs.sort((a, b) => a.localeCompare(b)) }))
                );
            } catch (err) {
                console.error('Error fetching holy grails:', err);
                // Holy Grails failing silently — stats still show
            }
        };

        fetchStats();
        fetchShowStats();
        fetchHolyGrails();
    }, []);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-8 flex flex-col items-center gap-4">
                <PSpinner size="large" aria={{ 'aria-label': 'Loading song statistics' }} />
                <PText color="contrast-medium">Loading statistics…</PText>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6">
                <PInlineNotification heading="Failed to load song stats" description={error || 'Unknown error'} state="error" dismissButton={false} />
            </div>
        );
    }

    const maxOriginalsPlays = stats.originals.top5.length > 0 ? stats.originals.top5[0].playCount : 1;
    const maxCoversPlays = stats.covers.top5.length > 0 ? stats.covers.top5[0].playCount : 1;
    const totalPlays = (songs) => songs.reduce((sum, s) => sum + s.playCount, 0);

    const SongColumn = ({ title, data, accentColor, maxPlays }) => {
        const animatedTotal = useCountUp(data.total);
        const uniqueLabel = title === 'Originals' ? 'Unique Songs Played Live' : 'Unique Covers Played Live';
        return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
            <div>
                <PHeading size="lg" tag="h3">{title}</PHeading>
                <div className="mt-3"><PDivider /></div>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-white/5 bg-white/5 p-5 text-center">
                <div className="font-display font-bold text-5xl leading-none mb-1 text-amber-400">{animatedTotal}</div>
                <PText size="sm" color="contrast-medium" align="center">{uniqueLabel}</PText>
                <PText size="xs" color="contrast-low" align="center">{totalPlays(data.top5)} total plays (top 5)</PText>
            </div>

            {/* Top 5 */}
            <div>
                <PText size="xs" color="contrast-medium" className="uppercase tracking-wide font-semibold mb-4">
                    Top 5 Most Played
                </PText>
                <ul className="space-y-4">
                    {data.top5.map((song, index) => {
                        const pct = (song.playCount / maxPlays) * 100;
                        return (
                            <li key={song.id} className="flex items-start gap-3">
                                <span className="font-bold text-sm mt-0.5 shrink-0 w-6" style={{ color: accentColor }}>
                                    #{index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <PText weight="semi-bold" ellipsis>{song.title}</PText>
                                        <PText size="xs" color="contrast-medium" className="whitespace-nowrap shrink-0">
                                            {song.playCount === 1 ? '1 play' : `${song.playCount} plays`}
                                        </PText>
                                    </div>
                                    <div className="h-1 rounded-full overflow-hidden mb-1" style={{ background: 'var(--p-color-contrast-lower)' }}>
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${pct}%`, background: accentColor }}
                                        />
                                    </div>
                                    {song.original_artist && (
                                        <PText size="xs" color="contrast-low">{song.original_artist}</PText>
                                    )}
                                    {song.lastPlayed && (
                                        <PText size="xs" color="contrast-low">Last: {formatDate(song.lastPlayed)}</PText>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
        );
    };

    return (
        <div className="space-y-6">

            {/* By the Numbers */}
            {showStats && (
                <div className="space-y-4">
                    <PHeading size="md" tag="h2">By the Numbers</PHeading>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        <FactCard
                            label="Shows in Archive"
                            value={showStats.totalShows.toLocaleString()}
                            sub="total concerts documented"
                        />
                        {showStats.topMonth && (
                            <FactCard
                                label="Most Active Month"
                                value={showStats.topMonth.name}
                                sub={`${showStats.topMonth.count} shows`}
                            />
                        )}
                        {showStats.topDow && (
                            <FactCard
                                label="Favorite Day"
                                value={`${showStats.topDow.name}s`}
                                sub={`${showStats.topDow.count} shows on a ${showStats.topDow.name}`}
                            />
                        )}
                        {showStats.uniqueCities > 0 && (
                            <FactCard
                                label="Cities Played"
                                value={`${showStats.uniqueCities} cities`}
                                sub={`across ${showStats.uniqueCountries} countr${showStats.uniqueCountries !== 1 ? 'ies' : 'y'}`}
                            />
                        )}
                    </div>

                    {/* Shows by Year bar chart */}
                    {showStats.yearRows.length > 1 && (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 space-y-3">
                            <PText size="xs" color="contrast-low" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shows by Year</PText>
                            <div className="space-y-2">
                                {showStats.yearRows.map(({ year, count }) => (
                                    <div key={year} className="flex items-center gap-3">
                                        <span className="text-xs w-10 shrink-0 text-right" style={{ color: 'var(--p-color-contrast-medium)' }}>{year}</span>
                                        <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden">
                                            <div
                                                className="h-full rounded bg-amber-400/80 transition-all duration-700"
                                                style={{ width: `${(count / showStats.maxYearCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs w-6 shrink-0 text-right" style={{ color: 'var(--p-color-contrast-medium)' }}>{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <PHeading size="xs" tag="h2">Song Stats</PHeading>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SongColumn
                    title="Originals"
                    data={stats.originals}
                    accentColor="#f59e0b"
                    maxPlays={maxOriginalsPlays}
                />
                <SongColumn
                    title="Covers"
                    data={stats.covers}
                    accentColor="#c084fc"
                    maxPlays={maxCoversPlays}
                />
            </div>

            {/* Holy Grails */}
            {holyGrails.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-[#1a1e26] p-6 space-y-5">
                    <div>
                        <PHeading size="lg" tag="h3">Holy Grails</PHeading>
                        <PText size="small" color="contrast-medium">Original songs that have never been played live</PText>
                        <div className="mt-3"><PDivider /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                        {holyGrails.map(album => (
                            <div key={album.title}>
                                <PText size="xs" weight="semi-bold" className="uppercase tracking-wide mb-2" style={{ color: '#f59e0b' }}>
                                    {album.title}
                                </PText>
                                <ul className="space-y-1.5 mt-2">
                                    {album.songs.map(title => (
                                        <li key={title} className="flex items-start gap-2">
                                            <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                                            <PText size="small" color="contrast-medium">{title}</PText>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <PText size="xs" color="contrast-low" align="center">
                Data as of {formatDate(new Date().toISOString())}
            </PText>
        </div>
    );
}
