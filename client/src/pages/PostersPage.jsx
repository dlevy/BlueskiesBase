import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner, PText } from '@porsche-design-system/components-react';
import { getAllPosters, getPostersForTrade } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';
import ExpressInterestForm from '../components/ExpressInterestForm';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

// Most posters are portrait and fill the aspect-[2/3] tile edge-to-edge with
// object-cover. A poster that isn't narrower than the tile itself — landscape
// or square — gets cropped on the sides that way, so once we know (from the
// loaded image's own dimensions) that it's at least as wide as it is tall,
// switch to object-contain to show the whole poster — which leaves empty
// space above/below, so a thin border frames that space rather than leaving
// it looking like a layout mistake.
function useUncroppedImageDetection() {
    const [needsContain, setNeedsContain] = useState(false);
    const handleImageLoad = (e) => {
        if (e.target.naturalWidth >= e.target.naturalHeight) setNeedsContain(true);
    };
    return [needsContain, handleImageLoad];
}

function PosterTile({ poster, onImageClick }) {
    const show = poster.shows;
    const showCount = poster.showCount || 1;
    const isTourPoster = showCount > 1;
    const lastShow = isTourPoster ? poster.linkedShows[poster.linkedShows.length - 1] : null;
    const [needsContain, handleImageLoad] = useUncroppedImageDetection();

    return (
        <div className="group rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-amber-500/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/30 transition-all duration-150">
            <button
                type="button"
                onClick={onImageClick}
                className={`relative block w-full aspect-[2/3] overflow-hidden bg-white/5 cursor-pointer ${needsContain ? 'border border-white/15' : ''}`}
            >
                <img
                    src={poster.thumbnail_url || poster.poster_url}
                    alt={poster.caption || `${show.artist_name} poster — ${show.venues?.name || show.venues?.city || ''}`}
                    loading="lazy"
                    onLoad={handleImageLoad}
                    className={`w-full h-full ${needsContain ? 'object-contain' : 'object-cover'} group-hover:scale-105 transition-transform duration-300`}
                />
                {poster.is_foil && (
                    <span
                        className="absolute top-1.5 right-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(192,132,252,0.85)', color: '#1a0b2e' }}
                    >
                        Foil
                    </span>
                )}
            </button>

            <Link to={buildShowPath(show)} className="block p-3 pb-1 hover:bg-white/[0.05] transition-colors">
                <p className="text-xs font-mono uppercase tracking-wide" style={{ color: 'var(--p-color-contrast-low)' }}>
                    {isTourPoster
                        ? `${formatDate(show.show_date)} – ${formatDate(lastShow.show_date)}`
                        : formatDate(show.show_date)}
                </p>
                <p className="text-sm font-semibold truncate mt-0.5" style={{ color: 'var(--p-color-primary)' }}>
                    {show.artist_name}
                </p>
                {isTourPoster ? (
                    <p className="text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {showCount} shows
                    </p>
                ) : show.venues && (
                    <p className="text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {show.venues.name}
                        <span style={{ color: 'var(--p-color-contrast-low)' }}>
                            {' — '}{show.venues.city}{show.venues.state_country ? `, ${show.venues.state_country}` : ''}
                        </span>
                    </p>
                )}
            </Link>

            {/* Own row (not inside the Link) so the credit's own <a> isn't nested inside
                the show-page link; fixed height so tiles stay aligned either way. */}
            <div className="px-3 pb-3 h-5">
                {poster.poster_artist_name ? (
                    <p className="text-xs font-mono truncate text-left" style={{ color: 'var(--p-color-contrast-low)' }}>
                        Poster art by{' '}
                        {poster.poster_artist_url ? (
                            <a href={poster.poster_artist_url} target="_blank" rel="noopener noreferrer"
                                className="font-semibold text-amber-400 hover:underline">
                                {poster.poster_artist_name}
                            </a>
                        ) : (
                            <span className="font-semibold" style={{ color: 'var(--p-color-contrast-medium)' }}>{poster.poster_artist_name}</span>
                        )}
                    </p>
                ) : (
                    <span aria-hidden="true">&nbsp;</span>
                )}
            </div>
        </div>
    );
}

function ForTradeTile({ listing }) {
    const show = listing.show;
    const owner = listing.owner;
    const [needsContain, handleImageLoad] = useUncroppedImageDetection();

    return (
        <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-amber-500/30 transition-all duration-150">
            <Link to={buildShowPath(show)} className={`relative block w-full aspect-[2/3] overflow-hidden bg-white/5 ${needsContain ? 'border border-white/15' : ''}`}>
                <img
                    src={listing.thumbnailUrl || listing.posterUrl}
                    alt={`${show.artist_name} poster`}
                    loading="lazy"
                    onLoad={handleImageLoad}
                    className={`w-full h-full ${needsContain ? 'object-contain' : 'object-cover'}`}
                />
                {listing.hasFoil && (
                    <span
                        className="absolute top-1.5 right-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(192,132,252,0.85)', color: '#1a0b2e' }}
                    >
                        Foil
                    </span>
                )}
            </Link>
            <div className="p-3 space-y-1.5">
                <p className="text-xs font-mono uppercase tracking-wide" style={{ color: 'var(--p-color-contrast-low)' }}>
                    {formatDate(show.show_date)}
                </p>
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--p-color-primary)' }}>
                    {show.artist_name}
                </p>
                <p className="text-xs">
                    {owner?.username ? (
                        <Link to={`/profile/${owner.username}`} className="hover:underline" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            {owner.display_name || owner.username}
                        </Link>
                    ) : (
                        <span style={{ color: 'var(--p-color-contrast-low)' }}>{owner?.display_name || 'Private'}</span>
                    )}
                </p>
                {listing.tradeComment && (
                    <p className="text-xs italic" style={{ color: 'var(--p-color-contrast-medium)' }}>{listing.tradeComment}</p>
                )}
                <ExpressInterestForm collectionId={listing.id} />
            </div>
        </div>
    );
}

export default function PostersPage() {
    const [posters, setPosters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const [forTradeListings, setForTradeListings] = useState([]);
    const [forTradeExpanded, setForTradeExpanded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        getAllPosters()
            .then(data => {
                if (cancelled) return;
                setPosters(data.posters || []);
            })
            .catch(err => {
                console.error('[PostersPage] Error loading posters:', err);
                if (!cancelled) setError('Failed to load posters');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        getPostersForTrade()
            .then(data => {
                if (!cancelled) setForTradeListings(data.listings || []);
            })
            .catch(err => console.error('[PostersPage] Error loading for-trade listings:', err));

        return () => { cancelled = true; };
    }, []);

    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-6xl mx-auto">
            <SEO
                title="Posters"
                description="Show posters from the Sturgill Simpson and Johnny Blue Skies setlist archive, newest first."
            />

            <MainNavTabs />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Posters
                </h1>
            </div>

            {forTradeListings.length > 0 && (
                <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03]">
                    <button
                        type="button"
                        onClick={() => setForTradeExpanded(v => !v)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                        <span className="flex items-center gap-2">
                            <span className="font-display font-semibold text-sm" style={{ color: 'var(--p-color-primary)' }}>
                                Available for Sale/Trade
                            </span>
                            <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
                            >
                                {forTradeListings.length}
                            </span>
                        </span>
                        <svg
                            className={`w-4 h-4 shrink-0 transition-transform ${forTradeExpanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {forTradeExpanded && (
                        <div className="px-4 pb-4">
                            <p className="text-xs mb-3" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Posters members are offering up from their own collection.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                {forTradeListings.map(listing => (
                                    <ForTradeTile key={listing.id} listing={listing} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="mb-4 pt-2 border-t border-white/[0.07]">
                <h2 className="font-display font-bold text-lg" style={{ color: 'var(--p-color-primary)' }}>
                    Poster Archive
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    {posters.length > 0 ? `${posters.length} show poster${posters.length !== 1 ? 's' : ''}, newest first` : 'Show posters from the archive'}
                </p>
            </div>

            {loading && (
                <div className="flex justify-center py-16">
                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading posters' }} />
                </div>
            )}

            {!loading && error && (
                <PText color="notification-error" align="center" className="py-16">{error}</PText>
            )}

            {!loading && !error && posters.length === 0 && (
                <PText color="contrast-medium" align="center" className="py-16">
                    No posters uploaded yet.
                </PText>
            )}

            {!loading && !error && posters.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {posters.map((poster, index) => (
                        <PosterTile key={poster.id} poster={poster} onImageClick={() => setLightboxIndex(index)} />
                    ))}
                </div>
            )}

            <Lightbox
                open={lightboxIndex >= 0}
                close={() => setLightboxIndex(-1)}
                index={lightboxIndex}
                slides={posters.map(p => ({ src: p.poster_url, alt: p.caption || 'Show poster', title: p.caption }))}
                on={{ view: ({ index }) => setLightboxIndex(index) }}
            />
        </div>
    );
}
