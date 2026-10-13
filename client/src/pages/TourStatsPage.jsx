import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PSpinner, PInlineNotification } from '@porsche-design-system/components-react';
import { fetchTourList, fetchDefaultTourName, fetchTourSongCounts, ALL_SHOWS } from '../utils/tourSongCounts';
import { fetchGeographyOptions } from '../utils/geography';
import SEO from '../components/SEO';
import ShowMapShare from '../components/ShowMapShare';

const selectClass = "w-full sm:w-auto rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent";

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Opening/Closing Songs — one-off songs (count 1) are hidden by default to
// keep the default view compact; a "+N more" link reveals them (data's
// already loaded, this is just a local toggle, not a new fetch).
function TourSongBars({ songs, showAll, onShowMore }) {
    const visible = showAll ? songs : songs.filter(s => s.count > 1);
    const hiddenCount = songs.length - songs.filter(s => s.count > 1).length;
    const maxCount = songs[0]?.count || 0;
    return (
        <div className="space-y-1.5">
            {visible.map(({ title, count, isOriginal }) => (
                <div key={title} className="flex items-center gap-3">
                    <span className="text-xs w-40 sm:w-56 shrink-0 truncate text-right" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {title}
                    </span>
                    <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                        <div
                            className={`h-full rounded transition-all duration-700 ${isOriginal === false ? 'bg-blue-400/70' : 'bg-amber-400/80'}`}
                            style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs w-4 shrink-0" style={{ color: 'var(--p-color-contrast-medium)' }}>{count}</span>
                </div>
            ))}
            {!showAll && hiddenCount > 0 && (
                <button
                    type="button"
                    onClick={onShowMore}
                    className="text-xs hover:underline"
                    style={{ color: 'var(--p-color-info)' }}
                >
                    + {hiddenCount} more played once
                </button>
            )}
        </div>
    );
}

// Same purple star used for the per-song "Rare" badge on the show page — played at
// fewer than 15% of the tour's shows so far.
function RareTag({ count, total }) {
    return (
        <svg
            className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="#c084fc"
            aria-label="Rare" role="img"
        >
            <title>Rare — played {count} of {total} shows on this tour</title>
            <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.456A1 1 0 0112 2z" clipRule="evenodd" />
        </svg>
    );
}

export default function TourStatsPage() {
    const navigate = useNavigate();
    const [tours, setTours] = useState([]);
    const [selectedTour, setSelectedTour] = useState('');
    const [geoOptions, setGeoOptions] = useState({ states: [], countries: [] });
    const [stateFilter, setStateFilter] = useState('');
    const [countryFilter, setCountryFilter] = useState('');
    const [tourData, setTourData] = useState(null);
    const [loadingTours, setLoadingTours] = useState(true);
    const [loadingSongs, setLoadingSongs] = useState(false);
    const [error, setError] = useState(null);
    const [showAllOpeners, setShowAllOpeners] = useState(false);
    const [showAllClosers, setShowAllClosers] = useState(false);

    // Load the tour list once, then pick the default (current) tour.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [list, defaultTour] = await Promise.all([fetchTourList(), fetchDefaultTourName()]);
                if (cancelled) return;
                // Fall back to the most recent listed tour if the "current" tour got
                // filtered out of the list (fewer than MIN_TOUR_SHOWS shows). Computed
                // before "All Shows" is appended, so it's never picked as the default.
                const validDefault = list.some(t => t.tourName === defaultTour) ? defaultTour : null;
                setSelectedTour(validDefault || list[0]?.tourName || '');
                setTours([...list, { tourName: ALL_SHOWS }]);
            } catch (err) {
                console.error('[TourStatsPage] Error loading tour list:', err);
                if (!cancelled) setError('Failed to load tours');
            } finally {
                if (!cancelled) setLoadingTours(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // State/Country dropdown options are scoped to whichever tour is selected
    // (so e.g. picking "Mutiny for the Masses" only offers the states/countries
    // that tour actually played) — reload them whenever the tour changes, and
    // clear any filter that might no longer be valid for the new option list.
    useEffect(() => {
        if (!selectedTour) return;
        let cancelled = false;
        fetchGeographyOptions(selectedTour === ALL_SHOWS ? undefined : selectedTour)
            .then(geo => { if (!cancelled) setGeoOptions(geo); })
            .catch(err => console.error('[TourStatsPage] Error loading geography options:', err));
        setStateFilter('');
        setCountryFilter('');
        return () => { cancelled = true; };
    }, [selectedTour]);

    // Load song counts whenever the selected tour or geography filter changes.
    useEffect(() => {
        if (!selectedTour) return;
        let cancelled = false;
        setLoadingSongs(true);
        setError(null);
        setShowAllOpeners(false);
        setShowAllClosers(false);
        fetchTourSongCounts(selectedTour, { stateFilter: stateFilter || undefined, countryFilter: countryFilter || undefined })
            .then(data => { if (!cancelled) setTourData(data); })
            .catch(err => {
                console.error('[TourStatsPage] Error loading tour song counts:', err);
                if (!cancelled) setError('Failed to load tour stats');
            })
            .finally(() => { if (!cancelled) setLoadingSongs(false); });
        return () => { cancelled = true; };
    }, [selectedTour, stateFilter, countryFilter]);

    const maxCount = tourData?.songCounts?.[0]?.count || 0;

    return (
        <div className="px-4 py-8 max-w-4xl mx-auto space-y-6">
            <SEO
                title="Tour Stats"
                description="Every song played on tour, ranked by how many shows it's been played at."
            />

            <PButtonPure icon="arrow-left" onClick={() => navigate('/')}>
                Back to Search
            </PButtonPure>

            <div>
                <PHeading size="2xl" tag="h1">Tour Stats</PHeading>
                <PText color="contrast-medium">Every song played on tour, ranked by number of shows played at</PText>
            </div>

            {loadingTours ? (
                <div className="flex justify-center py-12"><PSpinner size="medium" /></div>
            ) : error && tours.length === 0 ? (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            ) : (
                <>
                    <div className="flex flex-wrap gap-3">
                        <div>
                            <label htmlFor="tour-select" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Tour
                            </label>
                            <select
                                id="tour-select"
                                value={selectedTour}
                                onChange={(e) => setSelectedTour(e.target.value)}
                                className={selectClass}
                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}
                            >
                                {tours.map(t => (
                                    <option key={t.tourName} value={t.tourName}>{t.tourName}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="state-select" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                State
                            </label>
                            <select
                                id="state-select"
                                value={stateFilter}
                                onChange={(e) => setStateFilter(e.target.value)}
                                className={selectClass}
                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}
                            >
                                <option value="">All States</option>
                                {geoOptions.states.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="country-select" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Country
                            </label>
                            <select
                                id="country-select"
                                value={countryFilter}
                                onChange={(e) => setCountryFilter(e.target.value)}
                                className={selectClass}
                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}
                            >
                                <option value="">All Countries</option>
                                {geoOptions.countries.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                        {loadingSongs ? (
                            <div className="flex justify-center py-12"><PSpinner size="medium" /></div>
                        ) : error ? (
                            <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
                        ) : !tourData || tourData.songCounts.length === 0 ? (
                            <PText color="contrast-medium">
                                {stateFilter || countryFilter ? 'No shows match the selected filters.' : 'No songs played yet on this tour.'}
                            </PText>
                        ) : (
                            <>
                                <div className="flex items-baseline justify-between mb-1">
                                    <PHeading size="large" tag="h2">{selectedTour}</PHeading>
                                </div>
                                <PText size="small" color="contrast-medium" className="mb-1 block">
                                    {tourData.playedShows} of {tourData.totalShows} shows played &middot; {formatDate(tourData.firstDate)}
                                    {tourData.lastDate !== tourData.firstDate && <> &rarr; {formatDate(tourData.lastDate)}</>}
                                    {' '}&middot; {tourData.songCounts.length} song{tourData.songCounts.length !== 1 ? 's' : ''} played
                                    {tourData.avgSongsPerShow > 0 && <> &middot; {tourData.avgSongsPerShow.toFixed(1)} songs/show avg</>}
                                </PText>

                                <PHeading size="small" tag="h3" className="mb-3">Songs Played</PHeading>

                                <div className="flex items-center gap-4 mb-5">
                                    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/80 inline-block" />
                                        Original
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                        <span className="w-2.5 h-2.5 rounded-sm bg-blue-400/70 inline-block" />
                                        Cover
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    {tourData.songCounts.map(({ title, count, isOriginal, isRare }) => (
                                        <div key={title} className="flex items-center gap-3">
                                            <div className="w-40 sm:w-56 shrink-0 flex items-center justify-end gap-1 overflow-hidden">
                                                {isRare && <RareTag count={count} total={tourData.showsWithSetlist} />}
                                                <span className="text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                                    {title}
                                                </span>
                                            </div>
                                            <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded transition-all duration-700 ${isOriginal === false ? 'bg-blue-400/70' : 'bg-amber-400/80'}`}
                                                    style={{ width: `${(count / maxCount) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs w-4 shrink-0" style={{ color: 'var(--p-color-contrast-medium)' }}>{count}</span>
                                        </div>
                                    ))}
                                </div>

                                {tourData.openingSongs.length > 0 && (
                                    <div className="mt-6">
                                        <PHeading size="small" tag="h3" className="mb-3">Opening Songs</PHeading>
                                        <TourSongBars songs={tourData.openingSongs} showAll={showAllOpeners} onShowMore={() => setShowAllOpeners(true)} />
                                    </div>
                                )}

                                {tourData.closingSongs.length > 0 && (
                                    <div className="mt-6">
                                        <PHeading size="small" tag="h3" className="mb-3">Closing Songs</PHeading>
                                        <TourSongBars songs={tourData.closingSongs} showAll={showAllClosers} onShowMore={() => setShowAllClosers(true)} />
                                    </div>
                                )}

                                {tourData.albumBreakdown.length > 0 && (
                                    <div className="mt-6">
                                        <PHeading size="small" tag="h3" className="mb-3">Album Breakdown</PHeading>
                                        <div className="space-y-1.5">
                                            {(() => {
                                                const bars = [
                                                    ...tourData.albumBreakdown,
                                                    ...(tourData.otherOriginals > 0 ? [{ title: 'Other', count: tourData.otherOriginals }] : []),
                                                    ...(tourData.covers > 0 ? [{ title: 'Covers', count: tourData.covers, isCover: true }] : []),
                                                ].sort((a, b) => b.count - a.count);
                                                const maxAlbumCount = Math.max(...bars.map(b => b.count));
                                                return bars.map(({ title, count, isCover }) => (
                                                    <div key={title} className="flex items-center gap-3">
                                                        <span className="text-xs w-40 sm:w-56 shrink-0 truncate text-right" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                                            {title}
                                                        </span>
                                                        <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded transition-all duration-700 ${isCover ? 'bg-blue-400/70' : 'bg-amber-400/80'}`}
                                                                style={{ width: `${(count / maxAlbumCount) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs w-4 shrink-0" style={{ color: 'var(--p-color-contrast-medium)' }}>{count}</span>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {tourData && (
                        <ShowMapShare
                            pastShows={tourData.pastShows}
                            upcomingShows={tourData.upcomingShows}
                            title={`${selectedTour} Tour Map`}
                            attendedLabel="Played"
                            showBadge={false}
                        />
                    )}
                </>
            )}
        </div>
    );
}
