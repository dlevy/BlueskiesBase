import { useState, useEffect } from 'react';
import { PHeading, PText, PDivider } from '@porsche-design-system/components-react';
import { getSongs, getCommunityStats } from '../services/api';
import { supabase } from '../services/supabase';
import { useCountUp } from '../hooks/useCountUp';
import { getCountry } from '../utils/geography';
import TourStatsModule from './TourStatsModule';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
    const [holyGrails, setHolyGrails] = useState([]);
    const [showStats, setShowStats] = useState(null);
    const [communityStats, setCommunityStats] = useState(null);

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
                // Originals, plus covers that are real album tracks — an
                // unplayed cover officially released on an album is still a
                // deep-cut worth spotlighting here, same reasoning as the
                // Discography page's album grouping.
                const unplayed = (songsData.songs || []).filter(
                    s => (s.is_original === true || (s.album_songs?.length > 0)) && s.performance_count === 0
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

        fetchShowStats();
        fetchHolyGrails();
        fetchCommunityStats();
    }, []);

    const formatDate = (dateString) => {
        // Called with both a plain DATE string (song.lastPlayed, e.g.
        // "2026-10-05") and a full ISO timestamp (new Date().toISOString()
        // below) — take just the date portion and parse it as local parts
        // rather than `new Date(dateString)`, which reads a bare date as UTC
        // midnight and can print the wrong day in a timezone west of UTC.
        const [year, month, day] = dateString.split('T')[0].split('-');
        return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

            {/* Tour Stats — same module as the standalone /tour-stats page,
                defaulting to the current/most-recent tour rather than "All
                Shows": across the whole archive, the Live Debuts list in
                particular balloons to an unhelpful wall of songs. */}
            <div className="space-y-4">
                <PHeading size="md" tag="h2">Tour Stats</PHeading>
                <TourStatsModule />
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
