import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PSpinner, PInlineNotification } from '@porsche-design-system/components-react';
import { fetchTourList, fetchDefaultTourName, fetchTourSongCounts } from '../utils/tourSongCounts';
import SEO from '../components/SEO';

const selectClass = "w-full sm:w-auto rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent";

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TourStatsPage() {
    const navigate = useNavigate();
    const [tours, setTours] = useState([]);
    const [selectedTour, setSelectedTour] = useState('');
    const [tourData, setTourData] = useState(null);
    const [loadingTours, setLoadingTours] = useState(true);
    const [loadingSongs, setLoadingSongs] = useState(false);
    const [error, setError] = useState(null);

    // Load the tour list once, then pick the default (current) tour.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [list, defaultTour] = await Promise.all([fetchTourList(), fetchDefaultTourName()]);
                if (cancelled) return;
                setTours(list);
                // Fall back to the most recent listed tour if the "current" tour got
                // filtered out of the list (fewer than MIN_TOUR_SHOWS shows).
                const validDefault = list.some(t => t.tourName === defaultTour) ? defaultTour : null;
                setSelectedTour(validDefault || list[0]?.tourName || '');
            } catch (err) {
                console.error('[TourStatsPage] Error loading tour list:', err);
                if (!cancelled) setError('Failed to load tours');
            } finally {
                if (!cancelled) setLoadingTours(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Load song counts whenever the selected tour changes.
    useEffect(() => {
        if (!selectedTour) return;
        let cancelled = false;
        setLoadingSongs(true);
        setError(null);
        fetchTourSongCounts(selectedTour)
            .then(data => { if (!cancelled) setTourData(data); })
            .catch(err => {
                console.error('[TourStatsPage] Error loading tour song counts:', err);
                if (!cancelled) setError('Failed to load tour stats');
            })
            .finally(() => { if (!cancelled) setLoadingSongs(false); });
        return () => { cancelled = true; };
    }, [selectedTour]);

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

                    <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                        {loadingSongs ? (
                            <div className="flex justify-center py-12"><PSpinner size="medium" /></div>
                        ) : error ? (
                            <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
                        ) : !tourData || tourData.songCounts.length === 0 ? (
                            <PText color="contrast-medium">No songs played yet on this tour.</PText>
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
                                    {tourData.songCounts.map(({ title, count, isOriginal }) => (
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
                                </div>

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
                </>
            )}
        </div>
    );
}
