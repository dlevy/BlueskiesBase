import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { PHeading, PText, PButton, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getAllPosters, getTourPhotos } from '../../services/api';
import { fetchTourSongCounts, fetchAlbumTrackTitles } from '../../utils/tourSongCounts';
import { buildTourMapImage } from '../../components/ShowMapShare';
import { getLocalDateString } from '../../utils/today';
import { TOUR_STAT_TYPES, getStatTypeByKey } from '../../utils/tourStatTypes';
import TourStatGraphic from '../../components/admin/TourStatGraphic';
import TourMosaicGraphic, { MOSAIC_WIDTH, MOSAIC_HEIGHT } from '../../components/admin/TourMosaicGraphic';
import { POST_STYLES, DEFAULT_STYLE_KEY, POST_WIDTH, POST_HEIGHT } from '../../utils/instagramStyles';
import useBackgroundImageDataUrl from '../../hooks/useBackgroundImageDataUrl';
import useBackgroundImageDataUrls from '../../hooks/useBackgroundImageDataUrls';
import useGraphicPngExport from '../../hooks/useGraphicPngExport';

const PREVIEW_WIDTH = 380;

// Same tiebreak GET /api/posters uses to pick a show's "representative"
// poster when it has several (comparePosterDisplayOrder in posters.js) —
// duplicated here since this is the only client page that needs to pick one
// poster per show rather than just listing all of them.
function comparePosterDisplayOrder(a, b) {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    if (a.is_primary) return (a.is_foil ? 1 : 0) - (b.is_foil ? 1 : 0);
    return (a.display_order ?? 0) - (b.display_order ?? 0) || (a.created_at || '').localeCompare(b.created_at || '');
}

// One representative poster URL per show, from the tour's own poster list
// (each poster already carries every show it's linked to — a tour-leg
// poster backs several shows at once). Thumbnail preferred over the full
// image: Tour Mosaic tiles are small, and thumbnails are already optimized
// for exactly this, same as every other poster picker in this codebase.
function buildPosterUrlByShow(postersForTour) {
    const byShow = new Map();
    postersForTour.forEach(poster => {
        (poster.linkedShows || []).forEach(linkedShow => {
            if (!byShow.has(linkedShow.id)) byShow.set(linkedShow.id, []);
            byShow.get(linkedShow.id).push(poster);
        });
    });
    const result = {};
    byShow.forEach((list, showId) => {
        const representative = [...list].sort(comparePosterDisplayOrder)[0];
        result[showId] = representative?.thumbnail_url || representative?.poster_url || null;
    });
    return result;
}

export default function TourStatsPostPage() {
    const { tourName: encodedTourName } = useParams();
    const tourName = decodeURIComponent(encodedTourName);

    const [tourData, setTourData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [mode, setMode] = useState('stat'); // 'stat' | 'mosaic'
    const [statKey, setStatKey] = useState(TOUR_STAT_TYPES[0].key);
    const [selectedAlbum, setSelectedAlbum] = useState('');
    const [neverPlayedTitles, setNeverPlayedTitles] = useState([]);
    const [styleKey, setStyleKey] = useState(DEFAULT_STYLE_KEY);
    const [backgroundMode, setBackgroundMode] = useState('style');
    const [posters, setPosters] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [selectedPosterUrl, setSelectedPosterUrl] = useState(null);
    const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(null);
    const [tourMapUrl, setTourMapUrl] = useState(null);
    const [tourMapLoading, setTourMapLoading] = useState(false);

    const graphicRef = useRef(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setSelectedAlbum('');
        setTourMapUrl(null);
        fetchTourSongCounts(tourName)
            .then(data => {
                if (!data) { setError('No shows found for this tour'); return; }
                setTourData(data);
            })
            .catch(err => {
                console.error('[TourStatsPostPage] Error loading tour data:', err);
                setError('Failed to load tour stats');
            })
            .finally(() => setLoading(false));
    }, [tourName]);

    useEffect(() => {
        getAllPosters()
            .then(data => {
                const forThisTour = (data.posters || []).filter(p => p.linkedShows?.some(s => s.tour_name === tourName));
                setPosters(forThisTour);
            })
            .catch(err => console.error('[TourStatsPostPage] Error loading posters:', err));
    }, [tourName]);

    useEffect(() => {
        getTourPhotos(tourName)
            .then(data => setPhotos(data.photos || []))
            .catch(err => console.error('[TourStatsPostPage] Error loading photos:', err));
    }, [tourName]);

    // Which of the selected album's actual tracks got zero plays on this
    // tour — tourData only ever knows about songs that appear in a setlist,
    // so a never-played track simply isn't in tourData.songsByAlbum at all;
    // the only way to know it exists is a separate catalog lookup, diffed
    // against what was actually played.
    useEffect(() => {
        if (!selectedAlbum || !tourData) { setNeverPlayedTitles([]); return; }
        let cancelled = false;
        fetchAlbumTrackTitles(selectedAlbum)
            .then(allTitles => {
                if (cancelled) return;
                const playedTitles = new Set((tourData.songsByAlbum?.[selectedAlbum] || []).map(s => s.title));
                setNeverPlayedTitles(allTitles.filter(t => !playedTitles.has(t)));
            })
            .catch(err => console.error('[TourStatsPostPage] Error loading album track list:', err));
        return () => { cancelled = true; };
    }, [selectedAlbum, tourData]);

    // Tour Snapshot uses the tour map as its backdrop instead of the usual
    // color/poster/photo choices (see TourStatGraphic's tourMapImageUrl
    // handling) — generated lazily, only once that stat is actually picked
    // (geocoding + the canvas draw isn't free), and cached in state so
    // switching away and back doesn't regenerate it.
    useEffect(() => {
        if (statKey !== 'tourSnapshot' || !tourData || tourMapUrl) return;
        let cancelled = false;
        setTourMapLoading(true);
        buildTourMapImage({ pastShows: tourData.pastShows, upcomingShows: tourData.upcomingShows, attendedLabel: 'Played' })
            .then(url => { if (!cancelled) setTourMapUrl(url); })
            .catch(err => console.error('[TourStatsPostPage] Error building tour map:', err))
            .finally(() => { if (!cancelled) setTourMapLoading(false); });
        return () => { cancelled = true; };
    }, [statKey, tourData, tourMapUrl]);

    // One compute() call per stat type, up front — lets the picker grey out
    // (and explain) any stat this tour has no data for, without re-deriving
    // results on every render. `selectedAlbum`/`neverPlayedTitles` are only
    // read by the by-album stats' compute(); every other stat just ignores
    // the extra arguments.
    const statResults = useMemo(() => {
        if (!tourData) return {};
        const results = {};
        TOUR_STAT_TYPES.forEach(stat => { results[stat.key] = stat.compute(tourData, selectedAlbum, neverPlayedTitles); });
        return results;
    }, [tourData, selectedAlbum, neverPlayedTitles]);

    const activeStatResult = statResults[statKey];

    const rawBackgroundImageUrl = backgroundMode === 'poster' ? selectedPosterUrl : backgroundMode === 'photo' ? selectedPhotoUrl : null;
    const { dataUrl: backgroundImageDataUrl, loading: backgroundImageLoading } = useBackgroundImageDataUrl(rawBackgroundImageUrl);

    // Tour Mosaic: every show on the tour, in date order, each tile backed
    // by that show's own representative poster — including a scheduled show
    // that hasn't happened (or hasn't had its setlist logged) yet, so the
    // mosaic reserves its tile/grid space rather than only sizing itself for
    // whatever's played so far (TourMosaicGraphic shows a "Setlist coming
    // soon" placeholder for it). Computed regardless of `mode` so flipping
    // the toggle doesn't have to wait for a fresh fetch, but cheap to skip
    // (posters is usually empty before its own effect resolves) when mosaic
    // hasn't been opened yet.
    const mosaicShows = useMemo(
        () => [...(tourData?.pastShows || []), ...(tourData?.upcomingShows || [])],
        [tourData]
    );
    const mosaicPosterUrlByShow = useMemo(() => buildPosterUrlByShow(posters), [posters]);
    const mosaicPosterUrls = useMemo(
        () => [...new Set(Object.values(mosaicPosterUrlByShow).filter(Boolean))],
        [mosaicPosterUrlByShow]
    );
    const { dataUrlByUrl: mosaicDataUrlByUrl, loading: mosaicImagesLoading } = useBackgroundImageDataUrls(
        mode === 'mosaic' ? mosaicPosterUrls : []
    );
    const mosaicPosterDataUrlByShow = useMemo(() => {
        const result = {};
        Object.entries(mosaicPosterUrlByShow).forEach(([showId, url]) => {
            result[showId] = url ? (mosaicDataUrlByUrl[url] || null) : null;
        });
        return result;
    }, [mosaicPosterUrlByShow, mosaicDataUrlByUrl]);

    const { generating, generatedImageUrl, download, clearGeneratedImage } = useGraphicPngExport(
        graphicRef,
        mode === 'mosaic' ? mosaicPosterUrls.map(u => mosaicDataUrlByUrl[u]).filter(Boolean) : backgroundImageDataUrl,
        mode === 'mosaic' ? 'tour_mosaic_post_download' : 'tour_stat_post_download'
    );

    const tourSlug = tourName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const handleDownload = () => {
        if (mode === 'mosaic') { download(`${tourSlug}-tour-mosaic.png`); return; }
        download(`${tourSlug}-${statKey}-tour-stat.png`);
    };

    if (loading) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    if (error || !tourData) {
        return <PInlineNotification heading="Error" description={error || 'Tour not found'} state="error" dismissButton={false} />;
    }

    // A tour's scheduled last date is often still in the future — showing
    // that as the graphic's date range would misrepresent a card generated
    // mid-tour as a complete retrospective. Clamp the displayed end date to
    // today and flag it so the graphic can note this is a snapshot, not the
    // finished tour. Placed after the loading/error guards above since it
    // dereferences tourData, which is null until that effect resolves.
    const todayStr = getLocalDateString();
    const tourIsOngoing = tourData.lastDate > todayStr;
    const displayLastDate = tourIsOngoing ? todayStr : tourData.lastDate;

    // Every show on a tour shares the same artist/band name in practice —
    // first match from either list is enough, no need to tally/vote across shows.
    const artistName = tourData.pastShows?.[0]?.artist_name || tourData.upcomingShows?.[0]?.artist_name || null;

    const graphicWidth = mode === 'mosaic' ? MOSAIC_WIDTH : POST_WIDTH;
    const graphicHeight = mode === 'mosaic' ? MOSAIC_HEIGHT : POST_HEIGHT;
    const previewHeight = Math.round(PREVIEW_WIDTH * (graphicHeight / graphicWidth));
    const previewScale = PREVIEW_WIDTH / graphicWidth;

    return (
        <div className="space-y-6">
            <div>
                <PHeading size="2xl" tag="h1">Tour Stats Post</PHeading>
                <PText size="small" color="contrast-medium">
                    {tourName} &middot; {tourData.playedShows} of {tourData.totalShows} shows played
                </PText>
            </div>

            <div className="flex gap-1.5">
                <button
                    type="button"
                    onClick={() => setMode('stat')}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
                        mode === 'stat' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                    }`}
                    style={mode !== 'stat' ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                >
                    Single Stat Card
                </button>
                <button
                    type="button"
                    onClick={() => setMode('mosaic')}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
                        mode === 'mosaic' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                    }`}
                    style={mode !== 'mosaic' ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                >
                    Full Tour Mosaic
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
                {/* Controls */}
                <div className="space-y-5 rounded-2xl border border-white/10 p-5" style={{ background: 'var(--p-color-surface)' }}>
                    {mode === 'mosaic' && (
                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="block">
                            One tile per show on the tour ({mosaicShows.length} shows), each using its own poster as
                            the backdrop — printable at 24x18in. A show still awaiting its setlist (or its poster)
                            still reserves its tile, falling back to the plain style color below.
                        </PText>
                    )}
                    <div style={mode === 'mosaic' ? { display: 'none' } : undefined}>
                        <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Stat
                        </label>
                        <div className="space-y-1.5">
                            {TOUR_STAT_TYPES.map(stat => {
                                // Whether this stat type is choosable at all (e.g. no
                                // albums exist for this tour) — separate from the
                                // currently-computed result's own `disabled`, which for
                                // Song Count by Album is true whenever no album is picked
                                // YET. Conflating the two would greet the button out the
                                // moment nothing was selected, with no way to click it to
                                // reach the album picker in the first place.
                                const unavailable = stat.isAvailable ? !stat.isAvailable(tourData) : false;
                                const result = statResults[stat.key];
                                return (
                                    <button
                                        key={stat.key}
                                        type="button"
                                        onClick={() => !unavailable && setStatKey(stat.key)}
                                        disabled={unavailable}
                                        title={unavailable ? result?.disabledReason : undefined}
                                        className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                            statKey === stat.key
                                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                                : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                                        }`}
                                        style={statKey !== stat.key ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                                    >
                                        {stat.label}
                                    </button>
                                );
                            })}
                        </div>
                        {getStatTypeByKey(statKey)?.needsAlbum && (
                            <select
                                value={selectedAlbum}
                                onChange={(e) => setSelectedAlbum(e.target.value)}
                                className="w-full mt-2 rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}
                            >
                                <option value="">Select an album…</option>
                                {(tourData.albumBreakdown || []).map(a => (
                                    <option key={a.title} value={a.title}>{a.title}</option>
                                ))}
                            </select>
                        )}
                        {activeStatResult?.disabled && (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-2 block">
                                {activeStatResult.disabledReason}
                            </PText>
                        )}
                    </div>

                    {mode === 'stat' && statKey === 'tourSnapshot' && (
                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="block -mb-2">
                            Tour Snapshot always uses the tour map as its background — the Background/Style choices below don't apply to it.
                        </PText>
                    )}
                    <div style={mode === 'mosaic' ? { display: 'none' } : statKey === 'tourSnapshot' ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
                        <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Background
                        </label>
                        <div className="space-y-1.5">
                            <button
                                type="button"
                                onClick={() => setBackgroundMode('style')}
                                className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all ${
                                    backgroundMode === 'style'
                                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                        : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                                }`}
                                style={backgroundMode !== 'style' ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                            >
                                Color Style
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (posters.length === 0) return;
                                    setBackgroundMode('poster');
                                    if (!selectedPosterUrl) setSelectedPosterUrl(posters[0].poster_url);
                                }}
                                disabled={posters.length === 0}
                                className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                    backgroundMode === 'poster'
                                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                        : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                                }`}
                                style={backgroundMode !== 'poster' ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                            >
                                Tour Poster
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (photos.length === 0) return;
                                    setBackgroundMode('photo');
                                    if (!selectedPhotoUrl) setSelectedPhotoUrl(photos[0].photo_url);
                                }}
                                disabled={photos.length === 0}
                                className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                    backgroundMode === 'photo'
                                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                        : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                                }`}
                                style={backgroundMode !== 'photo' ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                            >
                                Tour Photo
                            </button>
                        </div>

                        {posters.length === 0 && backgroundMode === 'poster' && (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-2 block">
                                No posters uploaded for this tour yet.
                            </PText>
                        )}
                        {backgroundMode === 'poster' && posters.length > 0 && (
                            <div className="grid grid-cols-5 gap-1.5 mt-2 max-h-56 overflow-y-auto">
                                {posters.map(poster => (
                                    <button
                                        key={poster.id}
                                        type="button"
                                        onClick={() => setSelectedPosterUrl(poster.poster_url)}
                                        className="aspect-square rounded-md overflow-hidden border-2 transition-all"
                                        style={{ borderColor: selectedPosterUrl === poster.poster_url ? '#f59e0b' : 'transparent' }}
                                    >
                                        <img src={poster.thumbnail_url || poster.poster_url} alt={poster.caption || 'Tour poster'} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {photos.length === 0 && backgroundMode === 'photo' && (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-2 block">
                                No photos uploaded for this tour yet.
                            </PText>
                        )}
                        {backgroundMode === 'photo' && photos.length > 0 && (
                            <div className="grid grid-cols-5 gap-1.5 mt-2 max-h-56 overflow-y-auto">
                                {photos.map(photo => (
                                    <button
                                        key={photo.id}
                                        type="button"
                                        onClick={() => setSelectedPhotoUrl(photo.photo_url)}
                                        className="aspect-square rounded-md overflow-hidden border-2 transition-all"
                                        style={{ borderColor: selectedPhotoUrl === photo.photo_url ? '#f59e0b' : 'transparent' }}
                                    >
                                        <img src={photo.thumbnail_url || photo.photo_url} alt={photo.caption || 'Tour photo'} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={mode === 'stat' && (backgroundMode !== 'style' || statKey === 'tourSnapshot') ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
                        <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            {mode === 'mosaic' ? 'Style (fallback color for shows with no poster)' : 'Style'}
                        </label>
                        <div className="space-y-1.5">
                            {POST_STYLES.map(s => (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() => setStyleKey(s.key)}
                                    className={`w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg border transition-all ${
                                        styleKey === s.key
                                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                            : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                                    }`}
                                    style={styleKey !== s.key ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                                >
                                    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20" style={{ background: s.background }} />
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        {mode === 'stat' && backgroundMode !== 'style' && (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-3 block">
                                Not used while background is set to {backgroundMode === 'poster' ? 'Tour Poster' : 'Tour Photo'} — image backgrounds always use a fixed high-contrast overlay for readability.
                            </PText>
                        )}
                    </div>

                    <PButton
                        onClick={handleDownload}
                        loading={generating}
                        disabled={mode === 'mosaic'
                            ? (mosaicImagesLoading || mosaicShows.length === 0)
                            : (backgroundImageLoading || activeStatResult?.disabled || (statKey === 'tourSnapshot' && tourMapLoading))}
                        className="w-full"
                    >
                        {mode === 'mosaic'
                            ? (mosaicImagesLoading ? 'Loading posters…' : 'Download PNG')
                            : (statKey === 'tourSnapshot' && tourMapLoading ? 'Generating map…' : backgroundImageLoading ? 'Loading background…' : 'Download PNG')}
                    </PButton>
                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="block -mt-3">
                        On iPhone/iPad: Safari can't auto-download images — after generating, a full-size preview opens
                        below. Long-press it and tap "Save Image" instead.
                    </PText>
                </div>

                {/* Preview */}
                <div className="flex items-start justify-center rounded-2xl border border-white/10 p-8" style={{ background: 'var(--p-color-canvas)' }}>
                    <div style={{ width: PREVIEW_WIDTH, height: previewHeight, overflow: 'hidden', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
                        <div style={{ width: graphicWidth, height: graphicHeight, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                            {mode === 'mosaic' ? (
                                mosaicShows.length > 0 ? (
                                    <TourMosaicGraphic
                                        ref={graphicRef}
                                        tourName={tourName}
                                        artistName={artistName}
                                        firstDate={mosaicShows[0].show_date}
                                        lastDate={mosaicShows[mosaicShows.length - 1].show_date}
                                        shows={mosaicShows}
                                        setlistSongsByShow={tourData.setlistSongsByShow}
                                        posterUrlByShow={mosaicPosterDataUrlByShow}
                                        styleKey={styleKey}
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p-color-contrast-low)' }}>
                                        No shows found for this tour
                                    </div>
                                )
                            ) : (
                                <>
                                    {!activeStatResult?.disabled && !(statKey === 'tourSnapshot' && tourMapLoading) && (
                                        <TourStatGraphic
                                            ref={graphicRef}
                                            tourName={tourName}
                                            artistName={artistName}
                                            firstDate={tourData.firstDate}
                                            lastDate={displayLastDate}
                                            isOngoing={tourIsOngoing}
                                            styleKey={styleKey}
                                            backgroundMode={backgroundMode}
                                            backgroundImageUrl={backgroundImageDataUrl}
                                            tourMapImageUrl={statKey === 'tourSnapshot' ? tourMapUrl : null}
                                            statResult={activeStatResult}
                                        />
                                    )}
                                    {statKey === 'tourSnapshot' && tourMapLoading && (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <PSpinner size="medium" aria={{ 'aria-label': 'Generating tour map' }} />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Generated-image preview — same iOS Safari long-press-to-save fallback
                as the per-show Instagram post generator. */}
            {generatedImageUrl && (
                <div
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 gap-4"
                    style={{ background: 'rgba(0,0,0,0.92)' }}
                    onClick={clearGeneratedImage}
                >
                    <button
                        type="button"
                        onClick={clearGeneratedImage}
                        className="absolute top-4 right-4 text-sm text-white px-3 py-1.5 rounded-lg border border-white/30 hover:bg-white/10"
                    >
                        Close
                    </button>
                    <img
                        src={generatedImageUrl}
                        alt="Generated tour stat post"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 12 }}
                    />
                    <p className="text-center text-xs text-white/80 max-w-sm">
                        On iPhone/iPad: long-press the image above and tap "Save Image" or "Add to Photos".
                    </p>
                </div>
            )}
        </div>
    );
}
