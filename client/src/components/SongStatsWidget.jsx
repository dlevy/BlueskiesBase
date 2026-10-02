import { useState, useEffect, useCallback, useRef } from 'react';
import { PHeading, PText, PSpinner, PInlineNotification, PDivider } from '@porsche-design-system/components-react';
import { getGlobalSongStats, getSongs, getCommunityStats } from '../services/api';
import { supabase } from '../services/supabase';
import { useCountUp } from '../hooks/useCountUp';
import { fetchTourList } from '../utils/tourSongCounts';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</PText>
            <div className="text-sm font-semibold" style={{ color: 'var(--p-color-primary)' }}>{value}</div>
            {sub && <PText size="xs" color="contrast-medium">{sub}</PText>}
        </div>
    );
}

function CommunityStatCard({ value, label }) {
    const count = useCountUp(value);
    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 text-center">
            <div className="font-display font-bold text-5xl leading-none mb-2 text-amber-400">{count}</div>
            <PText size="sm" color="contrast-medium" align="center">{label}</PText>
        </div>
    );
}

export default function SongStatsWidget() {
    const [stats, setStats] = useState(null);
    const [holyGrails, setHolyGrails] = useState([]);
    const [showStats, setShowStats] = useState(null);
    const [communityStats, setCommunityStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Song Stats filter — only this section's data (not By the Numbers, not
    // Community) responds to it. "range" stages start/end in local inputs
    // behind an Apply button so typing a date doesn't refetch on every
    // keystroke; "tour" refetches immediately on selection, a single discrete choice.
    const [filterMode, setFilterMode] = useState('all');
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [tourList, setTourList] = useState([]);
    const [selectedTour, setSelectedTour] = useState('');
    const [songStatsLoading, setSongStatsLoading] = useState(false);
    const [songStatsError, setSongStatsError] = useState(null);
    const [originalsChecked, setOriginalsChecked] = useState(true);
    const [coversChecked, setCoversChecked] = useState(true);

    // Only the very first load (before any successful fetch) blanks the whole
    // widget on failure — a later filter-change failure just shows inline
    // songStatsError near the filter controls, keeping the last-good stats visible.
    const loadedOnceRef = useRef(false);
    const loadSongStats = useCallback(async (filterParams = {}) => {
        try {
            setSongStatsLoading(true);
            setSongStatsError(null);
            const statsData = await getGlobalSongStats(filterParams);
            setStats(statsData);
            loadedOnceRef.current = true;
        } catch (err) {
            console.error('Error fetching song stats:', err);
            setSongStatsError(err.message);
            if (!loadedOnceRef.current) setError(err.message);
        } finally {
            setSongStatsLoading(false);
            setLoading(false);
        }
    }, []);

    const handleFilterModeChange = (mode) => {
        setFilterMode(mode);
        if (mode === 'all') loadSongStats();
        else if (mode === 'tour' && selectedTour) loadSongStats({ tour: selectedTour });
        // 'range': wait for Apply — nothing to refetch yet.
    };

    const handleTourChange = (e) => {
        const tour = e.target.value;
        setSelectedTour(tour);
        if (tour) loadSongStats({ tour });
    };

    const handleApplyRange = () => {
        if (!rangeStart && !rangeEnd) return;
        loadSongStats({ startDate: rangeStart || undefined, endDate: rangeEnd || undefined });
    };

    // Can't uncheck the only box still on — would leave both boxes empty with
    // no way back to "all" except toggling the other one back on first.
    const toggleOriginals = () => setOriginalsChecked(prev => (prev && !coversChecked) ? prev : !prev);
    const toggleCovers = () => setCoversChecked(prev => (prev && !originalsChecked) ? prev : !prev);

    const PAGE_SIZE = 5;
    const [mostPlayedPage, setMostPlayedPage] = useState(0);
    const [rarestPage, setRarestPage] = useState(0);
    // The merged list's membership/order changes whenever the filter or the
    // checkboxes change — reset back to page 1 so a stale page index doesn't
    // land past the end of a now-shorter list.
    useEffect(() => {
        setMostPlayedPage(0);
        setRarestPage(0);
    }, [stats, originalsChecked, coversChecked]);

    useEffect(() => {
        const fetchShowStats = async () => {
            try {
                // Paginated — the archive is past 680 shows and growing every tour, and
                // an unbounded query silently caps at PostgREST's 1000-row default with
                // no error, quietly dropping shows out of every stat below.
                let data = [];
                for (let rangeStart = 0; ;) {
                    const { data: page, error: err } = await supabase
                        .from('shows')
                        .select('show_date, venues(city, state_country)')
                        .order('id')
                        .range(rangeStart, rangeStart + 999);
                    if (err) throw err;
                    data = data.concat(page || []);
                    if (!page || page.length < 1000) break;
                    rangeStart += 1000;
                }

                const monthCounts = {};
                const yearCounts  = {};
                const cities      = new Set();
                const countries   = new Set();

                for (const show of data) {
                    const [y, m, d] = show.show_date.split('-');
                    const date  = new Date(Number(y), Number(m) - 1, Number(d));
                    const month = MONTHS[date.getMonth()];

                    monthCounts[month] = (monthCounts[month] || 0) + 1;
                    yearCounts[y]      = (yearCounts[y]      || 0) + 1;

                    if (show.venues?.city) cities.add(show.venues.city);
                    const country = getCountry(show.venues?.state_country);
                    if (country) countries.add(country);
                }

                const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
                const yearRows = Object.entries(yearCounts)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([year, count]) => ({ year, count }));

                setShowStats({
                    totalShows:      data.length,
                    topMonth:        topMonth ? { name: topMonth[0], count: topMonth[1] } : null,
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

        const fetchCommunityStats = async () => {
            try {
                const data = await getCommunityStats();
                setCommunityStats(data);
            } catch (err) {
                console.error('Error fetching community stats:', err);
                // Community stats failing silently — core stats still show
            }
        };

        const fetchTours = async () => {
            try {
                setTourList(await fetchTourList({ minShows: 0 }));
            } catch (err) {
                console.error('Error fetching tour list:', err);
                // Tour filter just won't have options — Date Range/All Time still work
            }
        };

        loadSongStats();
        fetchShowStats();
        fetchHolyGrails();
        fetchCommunityStats();
        fetchTours();
    }, [loadSongStats]);

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

    // Each category's own top5/rarest (now sized well beyond 5 server-side —
    // see computeGlobalSongStats's `limit` param) is merged, checkbox-filtered,
    // and re-sorted here, giving enough rows for pagination beyond page 1.
    const mergedTop = [
        ...(originalsChecked ? stats.originals.top5 : []),
        ...(coversChecked ? stats.covers.top5 : []),
    ].sort((a, b) => b.playCount - a.playCount);
    const mergedRarest = [
        ...(originalsChecked ? stats.originals.rarest : []),
        ...(coversChecked ? stats.covers.rarest : []),
    ].sort((a, b) => a.playCount - b.playCount);
    const filteredUniqueTotal =
        (originalsChecked ? stats.originals.total : 0) + (coversChecked ? stats.covers.total : 0);
    // Rarest songs' bars must read as short relative to how much a popular
    // song gets played, not relative to each other (every rare song's play
    // count is close to every other rare song's, so scaling a bar to its own
    // list's max made every bar look nearly full) — anchor both boxes' bars
    // to the same overall "most played" ceiling.
    const overallMaxPlays = mergedTop[0]?.playCount || 1;

    const RankedSongBox = ({ title, subtitle, songs, accentColor, page, onPageChange }) => {
        const totalPages = Math.max(1, Math.ceil(songs.length / PAGE_SIZE));
        const pageSongs = songs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
        return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
            <div>
                <PHeading size="lg" tag="h3">{title}</PHeading>
                {subtitle && <PText size="xs" color="contrast-medium">{subtitle}</PText>}
                <div className="mt-3"><PDivider /></div>
            </div>

            {pageSongs.length === 0 ? (
                <PText color="contrast-medium">No songs match the current filters.</PText>
            ) : (
                <ul className="space-y-4">
                    {pageSongs.map((song, index) => {
                        const pct = (song.playCount / overallMaxPlays) * 100;
                        return (
                            <li key={song.id} className="flex items-start gap-3">
                                <span className="font-bold text-sm mt-0.5 shrink-0 w-6" style={{ color: accentColor }}>
                                    #{page * PAGE_SIZE + index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                                        <PText weight="semi-bold" ellipsis>{song.title}</PText>
                                        <PText size="xs" color="contrast-medium" className="whitespace-nowrap shrink-0">
                                            {song.playCount === 1 ? '1 play' : `${song.playCount} plays`}
                                        </PText>
                                        {!song.is_original && (
                                            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 whitespace-nowrap shrink-0">Cover</span>
                                        )}
                                    </div>
                                    <div className="h-1 rounded-full overflow-hidden mb-1" style={{ background: 'var(--p-color-contrast-lower)' }}>
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${pct}%`, background: accentColor }}
                                        />
                                    </div>
                                    {!song.is_original && song.original_artist && (
                                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>{song.original_artist}</PText>
                                    )}
                                    {song.lastPlayed && (
                                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>Last: {formatDate(song.lastPlayed)}</PText>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-1">
                    <button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)}
                        className="text-xs px-2 py-1 rounded disabled:opacity-30" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        ← Prev
                    </button>
                    <PText size="xs" color="contrast-medium">Page {page + 1} of {totalPages}</PText>
                    <button type="button" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}
                        className="text-xs px-2 py-1 rounded disabled:opacity-30" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Next →
                    </button>
                </div>
            )}
        </div>
        );
    };

    return (
        <div className="space-y-6">

            {/* By the Numbers */}
            {showStats && (
                <div className="space-y-4">
                    <PHeading size="md" tag="h2">By the Numbers</PHeading>

                    {/* Shows by Year — a compact sparkline, not a full chart; the total
                        show count lives here (as the left-side label's value) rather
                        than as its own separate card. Hover a bar for its year/count
                        (same title-attribute pattern as before). */}
                    {showStats.yearRows.length > 1 && (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-4 flex items-center gap-3">
                            <div className="shrink-0">
                                <PText size="xs" style={{ color: 'var(--p-color-contrast-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Shows by Year
                                </PText>
                                <div className="text-sm font-semibold" style={{ color: 'var(--p-color-primary)' }}>
                                    {showStats.totalShows.toLocaleString()} total
                                </div>
                            </div>
                            <div className="flex-1 flex items-end gap-0.5 h-8 overflow-hidden">
                                {showStats.yearRows.map(({ year, count }) => (
                                    <div
                                        key={year}
                                        className="flex-1 h-full flex flex-col justify-end"
                                        title={`${year}: ${count} show${count !== 1 ? 's' : ''}`}
                                    >
                                        <div
                                            className="w-full rounded-t bg-amber-400/80"
                                            style={{ height: `${Math.max((count / showStats.maxYearCount) * 100, 8)}%` }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="shrink-0 whitespace-nowrap">
                                {showStats.yearRows[0].year}–{showStats.yearRows[showStats.yearRows.length - 1].year}
                            </PText>
                        </div>
                    )}

                    {/* Same total width as the Shows by Year box above — a 2-up grid,
                        not the old 2/3/4-responsive grid, so the edges always line up. */}
                    <div className="grid grid-cols-2 gap-3">
                        {showStats.topMonth && (
                            <FactCard
                                label="Most Active Month"
                                value={showStats.topMonth.name}
                                sub={`${showStats.topMonth.count} shows`}
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
                </div>
            )}

            {/* Community */}
            {communityStats && (
                <div className="space-y-4">
                    <PHeading size="md" tag="h2">Community</PHeading>
                    <div className="grid grid-cols-3 gap-3">
                        <CommunityStatCard value={communityStats.members} label="Members" />
                        <CommunityStatCard value={communityStats.photos} label="Photos Contributed" />
                        <CommunityStatCard value={communityStats.posters} label="Posters Contributed" />
                    </div>

                </div>
            )}

            {/* Song Stats */}
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <PHeading size="md" tag="h2">Song Stats</PHeading>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
                            {[['all', 'All Time'], ['range', 'Date Range'], ['tour', 'Tour']].map(([mode, label]) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => handleFilterModeChange(mode)}
                                    className={`px-3 py-1.5 transition-colors ${filterMode === mode ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-white/5'}`}
                                    style={{ color: filterMode === mode ? undefined : 'var(--p-color-contrast-medium)' }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {filterMode === 'range' && (
                            <div className="flex items-center gap-2">
                                <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                                    className="rounded-lg border border-white/10 bg-white/5 py-1.5 px-2 text-xs" />
                                <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>to</span>
                                <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                                    className="rounded-lg border border-white/10 bg-white/5 py-1.5 px-2 text-xs" />
                                <button type="button" onClick={handleApplyRange} disabled={!rangeStart && !rangeEnd}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    Apply
                                </button>
                            </div>
                        )}

                        {filterMode === 'tour' && (
                            <select
                                value={selectedTour}
                                onChange={handleTourChange}
                                className="rounded-lg border border-white/10 py-1.5 px-2 text-xs"
                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}
                            >
                                <option value="">Select a tour…</option>
                                {tourList.map(t => (
                                    <option key={t.tourName} value={t.tourName}>{t.tourName}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        <input type="checkbox" checked={originalsChecked} onChange={toggleOriginals} />
                        Originals
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        <input type="checkbox" checked={coversChecked} onChange={toggleCovers} />
                        Covers
                    </label>
                    {songStatsLoading && <PSpinner size="small" aria={{ 'aria-label': 'Updating song stats' }} />}
                </div>

                {songStatsError && (
                    <PInlineNotification heading="Error" description={songStatsError} state="error" dismissButton={false} />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <RankedSongBox
                        title="Most Played"
                        subtitle={`${filteredUniqueTotal.toLocaleString()} unique songs played live`}
                        songs={mergedTop}
                        accentColor="#f59e0b"
                        page={mostPlayedPage}
                        onPageChange={setMostPlayedPage}
                    />
                    <RankedSongBox
                        title="Rarest Songs"
                        subtitle="Least-played, by distinct shows"
                        songs={mergedRarest}
                        accentColor="#c084fc"
                        page={rarestPage}
                        onPageChange={setRarestPage}
                    />
                </div>
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

            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} align="center">
                Data as of {formatDate(new Date().toISOString())}
            </PText>
        </div>
    );
}
