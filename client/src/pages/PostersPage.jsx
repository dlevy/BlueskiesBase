import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner, PText } from '@porsche-design-system/components-react';
import { getAllPosters, getPostersForTrade, getMyPosterCollection, addToPosterCollection, removeFromPosterCollection } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import { useAuth } from '../contexts/AuthContext';
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

function formatDropDateTime(isoString) {
    return new Date(isoString).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
}

// Once a drop is sold out, the exact time it dropped stops being useful
// information — just the date is kept.
function formatDropDate(isoString) {
    return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function UpcomingDropTile({ poster }) {
    const show = poster.shows;
    const isPast = new Date(poster.drop_at).getTime() <= Date.now();
    return (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <img
                src={poster.thumbnail_url || poster.poster_url}
                alt={poster.caption || `${show.artist_name} poster`}
                className="w-12 h-16 object-cover rounded-lg shrink-0"
            />
            <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--p-color-primary)' }}>
                    {show.artist_name} — {formatDate(show.show_date)}
                </p>
                <p className="text-xs font-mono" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    {isPast ? 'Available since' : 'Drops'} {formatDropDateTime(poster.drop_at)}
                </p>
                {poster.drop_url && (
                    <a
                        href={poster.drop_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-amber-400 hover:underline"
                    >
                        View drop →
                    </a>
                )}
            </div>
        </div>
    );
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

// Own <button>, not nested inside the image's lightbox-trigger <button> —
// nesting interactive elements is invalid HTML, so this is a sibling
// positioned via the shared wrapper's position:relative instead.
function CollectionButton({ isOwned, onToggle }) {
    const [working, setWorking] = useState(false);

    const handleClick = async (e) => {
        e.stopPropagation();
        if (working) return;
        setWorking(true);
        try {
            await onToggle();
        } finally {
            setWorking(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={working}
            title={isOwned ? 'Remove from my collection' : 'Add to my collection'}
            aria-label={isOwned ? 'Remove from my collection' : 'Add to my collection'}
            className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors disabled:opacity-50"
            style={{ background: 'rgba(0,0,0,0.7)', color: isOwned ? '#fbbf24' : '#fff' }}
        >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={isOwned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 3a1 1 0 00-1 1v16l7-4 7 4V4a1 1 0 00-1-1H6z" />
            </svg>
        </button>
    );
}

function PosterTile({ poster, onImageClick, isOwned, onToggleCollection }) {
    const show = poster.shows;
    const showCount = poster.showCount || 1;
    const isTourPoster = showCount > 1;
    const lastShow = isTourPoster ? poster.linkedShows[poster.linkedShows.length - 1] : null;
    const [needsContain, handleImageLoad] = useUncroppedImageDetection();

    return (
        <div className="group rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-amber-500/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/30 transition-all duration-150">
            <div className="relative">
                <button
                    type="button"
                    onClick={onImageClick}
                    className={`block w-full aspect-[2/3] overflow-hidden bg-white/5 cursor-pointer ${needsContain ? 'border border-white/15' : ''}`}
                >
                    <img
                        src={poster.thumbnail_url || poster.poster_url}
                        alt={poster.caption || `${show.artist_name} poster — ${show.venues?.name || show.venues?.city || ''}`}
                        loading="lazy"
                        onLoad={handleImageLoad}
                        className={`w-full h-full ${needsContain ? 'object-contain' : 'object-cover'} group-hover:scale-105 transition-transform duration-300`}
                    />
                </button>
                {poster.is_foil && (
                    <span
                        className="absolute top-1.5 right-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(192,132,252,0.85)', color: '#1a0b2e' }}
                    >
                        Foil
                    </span>
                )}
                {poster.owners?.count > 0 && (
                    <span
                        className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(0,0,0,0.7)', color: '#fbbf24' }}
                        title={`Owned by ${poster.owners.names.join(', ')}`}
                    >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
                        </svg>
                        {poster.owners.count}
                    </span>
                )}
                {poster.drop_sold_out && (
                    <span
                        className="absolute bottom-1.5 right-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(248,113,113,0.85)', color: '#1a0b0b' }}
                        title={poster.drop_at ? `AP drop on ${formatDropDate(poster.drop_at)} — sold out` : 'AP drop — sold out'}
                    >
                        AP Sold Out
                    </span>
                )}
                {onToggleCollection && (
                    <CollectionButton isOwned={isOwned} onToggle={onToggleCollection} />
                )}
            </div>

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

    return (
        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <Link to={buildShowPath(show)} className="relative shrink-0">
                <img
                    src={listing.thumbnailUrl || listing.posterUrl}
                    alt={`${show.artist_name} poster`}
                    loading="lazy"
                    className="w-12 h-16 object-cover rounded-lg"
                />
                {listing.hasFoil && (
                    <span
                        className="absolute -top-1 -right-1 text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded"
                        style={{ background: 'rgba(192,132,252,0.85)', color: '#1a0b2e' }}
                    >
                        Foil
                    </span>
                )}
            </Link>
            <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--p-color-primary)' }}>
                    {show.artist_name} — {formatDate(show.show_date)}
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
                <div className="pt-0.5">
                    <ExpressInterestForm collectionId={listing.id} />
                </div>
            </div>
        </div>
    );
}

export default function PostersPage() {
    const { user } = useAuth();
    const [posters, setPosters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const [forTradeListings, setForTradeListings] = useState([]);
    // The logged-in viewer's own collection, for the quick add/remove button
    // on each tile — a second, lighter-weight way into the same collection
    // EditProfilePage already manages in full (poster picker, foil/edition,
    // for-trade listing). Not fetched at all for a logged-out visitor.
    const [myCollection, setMyCollection] = useState([]);

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

    useEffect(() => {
        if (!user) { setMyCollection([]); return; }
        let cancelled = false;
        getMyPosterCollection()
            .then(data => { if (!cancelled) setMyCollection(data.collection || []); })
            .catch(err => console.error('[PostersPage] Error loading my poster collection:', err));
        return () => { cancelled = true; };
    }, [user]);

    const upcomingDrops = useMemo(() => {
        const now = Date.now();
        const withDrops = posters.filter(p => p.drop_at && !p.drop_sold_out);
        // Still-upcoming drops first (soonest first), then already-available
        // ones (most recently dropped first) — a drop keeps showing here
        // indefinitely once it's passed, until explicitly marked sold out.
        const future = withDrops.filter(p => new Date(p.drop_at).getTime() > now)
            .sort((a, b) => new Date(a.drop_at) - new Date(b.drop_at));
        const past = withDrops.filter(p => new Date(p.drop_at).getTime() <= now)
            .sort((a, b) => new Date(b.drop_at) - new Date(a.drop_at));
        return [...future, ...past];
    }, [posters]);

    const collectionEntryByPosterId = useMemo(() => {
        const map = new Map();
        myCollection.forEach(entry => {
            if (entry.user_posters?.id) map.set(entry.user_posters.id, entry);
        });
        return map;
    }, [myCollection]);

    const handleToggleCollection = async (posterId) => {
        const existing = collectionEntryByPosterId.get(posterId);
        try {
            if (existing) {
                await removeFromPosterCollection(existing.id);
                setMyCollection(prev => prev.filter(e => e.id !== existing.id));
            } else {
                const created = await addToPosterCollection(posterId);
                setMyCollection(prev => [...prev, { id: created.id, user_posters: { id: posterId } }]);
            }
        } catch (err) {
            console.error('[PostersPage] Error updating poster collection:', err);
            alert(err.message || 'Failed to update your collection');
        }
    };

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

            {upcomingDrops.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="font-display font-semibold text-sm" style={{ color: 'var(--p-color-primary)' }}>
                            Poster Drops
                        </span>
                        <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
                        >
                            {upcomingDrops.length}
                        </span>
                    </div>
                    <p className="text-xs mb-3" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        This list is only as complete as what's been entered — if you know of a drop that's missing, let us know and we'll add it.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {upcomingDrops.map(poster => (
                            <UpcomingDropTile key={poster.id} poster={poster} />
                        ))}
                    </div>
                </div>
            )}

            {forTradeListings.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-display font-semibold text-sm" style={{ color: 'var(--p-color-primary)' }}>
                            Available for Sale/Trade
                        </span>
                        <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
                        >
                            {forTradeListings.length}
                        </span>
                    </div>
                    <p className="text-xs mb-3" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Posters members are offering up from their own collection.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {forTradeListings.map(listing => (
                            <ForTradeTile key={listing.id} listing={listing} />
                        ))}
                    </div>
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
                        <PosterTile
                            key={poster.id}
                            poster={poster}
                            onImageClick={() => setLightboxIndex(index)}
                            isOwned={collectionEntryByPosterId.has(poster.id)}
                            onToggleCollection={user ? () => handleToggleCollection(poster.id) : null}
                        />
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
