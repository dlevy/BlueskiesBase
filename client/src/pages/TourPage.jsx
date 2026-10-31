import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PSpinner, PInlineNotification } from '@porsche-design-system/components-react';
import { fetchTourList, fetchTourSongCounts } from '../utils/tourSongCounts';
import { buildTourPath, slugify } from '../utils/tourSlug';
import { buildShowPath } from '../utils/showSlug';
import SEO from '../components/SEO';
import MainNavTabs from '../components/MainNavTabs';
import ShowListCard from '../components/ShowListCard';
import TourStatsModule from '../components/TourStatsModule';

function formatLongDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });
}

function formatShortDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function venueLabel(venues) {
    if (!venues) return '';
    const cityState = [venues.city, venues.state_country].filter(Boolean).join(', ');
    return [venues.name, cityState].filter(Boolean).join(' — ');
}

// Same label shape as songLabel in server/utils/tourMeta.js — plain text, no
// colored tags, since this renders as a dense comma-separated line rather
// than the badged rows ShowDetailPage's SongRow uses.
function songLabel(song) {
    let label = song.title;
    if (song.jams_into) label += ' →';
    if (song.performance_type === 'tease') label += ' (tease)';
    else if (song.performance_type === 'partial') label += ' (partial)';
    return label;
}

// Public, SEO-indexable landing page for a single tour — /tours/{slug}.
// Resolves the slug against real tour_name values (no dedicated DB column,
// same approach as show-page slugs) rather than trusting the URL param
// as-is, then renders every show's full setlist inline (the content
// "[tour] tour setlist" searches actually want) above the existing
// TourStatsModule breakdown. Server-side prerendering for crawlers lives in
// server/utils/tourMeta.js / api/[...path].js — keep both in sync.
export default function TourPage() {
    const { tourSlug } = useParams();
    const navigate = useNavigate();

    const [resolving, setResolving] = useState(true);
    const [tourName, setTourName] = useState(null);
    const [notFound, setNotFound] = useState(false);

    const [tourData, setTourData] = useState(null);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc');

    // Resolve the slug against real tour names — includes tours below the
    // public dropdown's 5-show floor (minShows: 0) so a direct link to a
    // small tour still works, same as the admin tour pages already rely on.
    useEffect(() => {
        let cancelled = false;
        fetchTourList({ minShows: 0 })
            .then(list => {
                if (cancelled) return;
                const matches = list.filter(t => slugify(t.tourName) === slugify(tourSlug));
                if (matches.length !== 1) {
                    if (matches.length > 1) {
                        console.warn(`[TourPage] Slug "${tourSlug}" matches ${matches.length} distinct tour names`);
                    }
                    setNotFound(true);
                } else {
                    setTourName(matches[0].tourName);
                }
            })
            .catch(err => {
                console.error('[TourPage] Error loading tour list:', err);
                if (!cancelled) setNotFound(true);
            })
            .finally(() => { if (!cancelled) setResolving(false); });
        return () => { cancelled = true; };
    }, [tourSlug]);

    // Canonical redirect once resolved, same shape as ShowDetailPage's.
    useEffect(() => {
        if (!tourName) return;
        const canonical = buildTourPath(tourName);
        if (canonical !== `/tours/${tourSlug}`) {
            navigate(canonical, { replace: true });
        }
    }, [tourName, tourSlug, navigate]);

    // needsExtras: false — this page's own setlist list only needs
    // pastShows/upcomingShows/setlistSongsByShow, all present either way;
    // TourStatsModule below does its own full fetch for the debuts/album
    // breakdown it actually needs, so skipping that work here avoids
    // duplicating the heaviest half of fetchTourSongCounts on every load.
    useEffect(() => {
        if (!tourName) return;
        let cancelled = false;
        setLoadingData(true);
        fetchTourSongCounts(tourName, { needsExtras: false })
            .then(data => { if (!cancelled) setTourData(data); })
            .catch(err => {
                console.error('[TourPage] Error loading tour data:', err);
                if (!cancelled) setError('Failed to load tour setlists');
            })
            .finally(() => { if (!cancelled) setLoadingData(false); });
        return () => { cancelled = true; };
    }, [tourName]);

    if (resolving) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto">
                <MainNavTabs />
                <div className="min-h-[40vh] flex items-center justify-center">
                    <PSpinner size="large" aria={{ 'aria-label': 'Loading tour' }} />
                </div>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto space-y-4">
                <SEO title="Tour Not Found" noindex />
                <MainNavTabs />
                <PInlineNotification heading="Tour not found" description="We couldn't find a tour at this URL." state="error" dismissButton={false} />
                <PButtonPure icon="arrow-left" onClick={() => navigate('/tour-stats')}>
                    Back to Tour Stats
                </PButtonPure>
            </div>
        );
    }

    const pastShows = tourData?.pastShows || [];
    const upcomingShows = tourData?.upcomingShows || [];
    const orderedPastShows = sortOrder === 'asc' ? pastShows : [...pastShows].slice().reverse();

    const firstDate = pastShows[0]?.show_date || upcomingShows[0]?.show_date;
    const lastDate = upcomingShows[upcomingShows.length - 1]?.show_date || pastShows[pastShows.length - 1]?.show_date;
    const dateRange = firstDate && lastDate
        ? (firstDate === lastDate ? formatShortDate(firstDate) : `${formatShortDate(firstDate)} – ${formatShortDate(lastDate)}`)
        : '';
    const artistName = pastShows[0]?.artist_name || upcomingShows[0]?.artist_name || '';
    const seoDescription = `Every ${artistName} show and full setlist from the ${tourName} tour`
        + (dateRange ? ` (${dateRange})` : '') + `, ${pastShows.length} show${pastShows.length === 1 ? '' : 's'} played.`;

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${window.location.origin}/` },
            { '@type': 'ListItem', position: 2, name: `${tourName} Tour Setlist`, item: `${window.location.origin}${buildTourPath(tourName)}` },
        ],
    };

    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto space-y-8">
            <SEO
                title={`${tourName} Tour Setlist`}
                description={seoDescription}
                jsonLd={breadcrumbJsonLd}
                path={buildTourPath(tourName)}
            />

            <MainNavTabs />

            <div>
                <PHeading size="2xl" tag="h1">{tourName} Tour Setlist</PHeading>
                {dateRange && (
                    <PText size="small" color="contrast-medium">
                        {dateRange} &middot; {pastShows.length} show{pastShows.length === 1 ? '' : 's'} played
                        {upcomingShows.length > 0 && <> &middot; {upcomingShows.length} upcoming</>}
                    </PText>
                )}
            </div>

            {loadingData ? (
                <div className="flex justify-center py-12"><PSpinner size="medium" /></div>
            ) : error ? (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            ) : (
                <>
                    {upcomingShows.length > 0 && (
                        <div>
                            <PHeading size="large" tag="h2" className="mb-3">Upcoming Shows</PHeading>
                            <div className="space-y-2">
                                {upcomingShows.map(show => (
                                    <ShowListCard key={show.id} show={show} />
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <PHeading size="large" tag="h2">Setlists</PHeading>
                            {pastShows.length > 1 && (
                                <PButtonPure
                                    icon={sortOrder === 'asc' ? 'arrow-down' : 'arrow-up'}
                                    onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                                >
                                    {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                                </PButtonPure>
                            )}
                        </div>

                        {pastShows.length === 0 ? (
                            <PText color="contrast-medium">Setlists will appear here once the tour kicks off.</PText>
                        ) : (
                            <div className="space-y-5">
                                {orderedPastShows.map(show => {
                                    const songs = tourData.setlistSongsByShow[show.id] || [];
                                    return (
                                        <div key={show.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                                            <Link to={buildShowPath(show)} className="hover:underline" style={{ color: 'var(--p-color-primary)' }}>
                                                <span className="font-semibold text-sm">{formatLongDate(show.show_date)}</span>
                                                {show.venues && (
                                                    <span className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}> — {venueLabel(show.venues)}</span>
                                                )}
                                            </Link>
                                            {songs.length > 0 && (
                                                <p className="text-xs mt-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                                    {songs.map(songLabel).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}

            <TourStatsModule defaultTour={tourName} />
        </div>
    );
}
