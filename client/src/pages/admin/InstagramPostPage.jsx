import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getShowById, getShowDebuts, getShowPhotos, getShowPoster } from '../../services/api';
import { buildShowPath } from '../../utils/showSlug';
import InstagramPostGraphic from '../../components/admin/InstagramPostGraphic';
import { POST_STYLES, DEFAULT_STYLE_KEY, POST_WIDTH, POST_HEIGHT } from '../../utils/instagramStyles';
import useBackgroundImageDataUrl from '../../hooks/useBackgroundImageDataUrl';
import useGraphicPngExport from '../../hooks/useGraphicPngExport';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

const PREVIEW_WIDTH = 380;

export default function InstagramPostPage() {
    const { id } = useParams();
    const [show, setShow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [styleKey, setStyleKey] = useState(DEFAULT_STYLE_KEY);
    const [liveDebutSongIds, setLiveDebutSongIds] = useState(new Set());
    const [tourDebutSongIds, setTourDebutSongIds] = useState(new Set());
    const [photos, setPhotos] = useState([]);
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const [posters, setPosters] = useState([]);
    const [backgroundMode, setBackgroundMode] = useState('style');
    const [posterVariant, setPosterVariant] = useState('regular');
    const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(null);

    const graphicRef = useRef(null);

    useEffect(() => {
        getShowById(id)
            .then(data => setShow(data))
            .catch(err => {
                console.error('[InstagramPostPage] Error loading show:', err);
                setError('Failed to load show');
            })
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        getShowDebuts(id)
            .then(data => {
                setLiveDebutSongIds(new Set(data.live_debut_song_ids || []));
                setTourDebutSongIds(new Set(data.tour_debut_song_ids || []));
            })
            .catch(err => console.error('[InstagramPostPage] Error loading debuts:', err));
    }, [id]);

    useEffect(() => {
        getShowPhotos(id)
            .then(data => setPhotos(data.photos || []))
            .catch(err => console.error('[InstagramPostPage] Error loading photos:', err));
    }, [id]);

    useEffect(() => {
        getShowPoster(id)
            .then(data => setPosters(data.posters || []))
            .catch(err => console.error('[InstagramPostPage] Error loading poster:', err));
    }, [id]);

    // Derived early (not after the loading/error guards below) so the hook
    // that depends on it stays unconditional, same as every other effect here.
    const regularPoster = posters.find(p => !p.is_foil && p.is_primary) || null;
    const foilPoster = posters.find(p => p.is_foil && p.is_primary) || null;
    const activePoster = (posterVariant === 'foil' && foilPoster) ? foilPoster : (regularPoster || foilPoster);
    const posterUrl = activePoster?.poster_url || null;
    const rawBackgroundImageUrl = backgroundMode === 'poster' ? posterUrl : backgroundMode === 'photo' ? selectedPhotoUrl : null;
    const { dataUrl: backgroundImageDataUrl, loading: backgroundImageLoading } = useBackgroundImageDataUrl(rawBackgroundImageUrl);
    const { generating, generatedImageUrl, download, clearGeneratedImage } = useGraphicPngExport(graphicRef, backgroundImageDataUrl);

    const handleDownload = () => {
        const datePart = show.show_date;
        const artistPart = show.artist_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        download(`${datePart}-${artistPart}-setlist.png`);
    };

    if (loading) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    if (error || !show) {
        return <PInlineNotification heading="Error" description={error || 'Show not found'} state="error" dismissButton={false} />;
    }

    const hasBothPosterVariants = !!regularPoster && !!foilPoster;
    const previewHeight = Math.round(PREVIEW_WIDTH * (POST_HEIGHT / POST_WIDTH));
    const previewScale = PREVIEW_WIDTH / POST_WIDTH;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <PHeading size="2xl" tag="h1">Instagram Post</PHeading>
                    <PText size="small" color="contrast-medium">
                        {show.artist_name} &middot; {show.show_date}
                    </PText>
                </div>
                <Link to={buildShowPath(show)} target="_blank">
                    <PButtonPure size="small" icon="arrow-right">View Show Page</PButtonPure>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
                {/* Controls */}
                <div className="space-y-5 rounded-2xl border border-white/10 p-5" style={{ background: 'var(--p-color-surface)' }}>
                    <div>
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
                                onClick={() => posters.length > 0 && setBackgroundMode('poster')}
                                disabled={posters.length === 0}
                                className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                    backgroundMode === 'poster'
                                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                        : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                                }`}
                                style={backgroundMode !== 'poster' ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                            >
                                Show Poster
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
                                Show Photos
                            </button>
                        </div>

                        {posters.length === 0 && backgroundMode !== 'photo' ? (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-2 block">
                                No poster uploaded for this show yet.
                            </PText>
                        ) : hasBothPosterVariants && backgroundMode === 'poster' ? (
                            <div className="flex gap-2 mt-2">
                                {['regular', 'foil'].map(variant => (
                                    <button
                                        key={variant}
                                        type="button"
                                        onClick={() => setPosterVariant(variant)}
                                        className={`flex-1 text-xs px-2 py-1.5 rounded-md border capitalize transition-all ${
                                            posterVariant === variant
                                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                                : 'border-white/10 hover:border-white/25'
                                        }`}
                                        style={posterVariant !== variant ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                                    >
                                        {variant}
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {photos.length === 0 && backgroundMode !== 'poster' ? (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-2 block">
                                No photos uploaded for this show yet.
                            </PText>
                        ) : backgroundMode === 'photo' ? (
                            <div className="grid grid-cols-5 gap-1.5 mt-2">
                                {photos.map(photo => (
                                    <button
                                        key={photo.id}
                                        type="button"
                                        onClick={() => setSelectedPhotoUrl(photo.photo_url)}
                                        className="aspect-square rounded-md overflow-hidden border-2 transition-all"
                                        style={{ borderColor: selectedPhotoUrl === photo.photo_url ? '#f59e0b' : 'transparent' }}
                                    >
                                        <img src={photo.photo_url} alt={photo.caption || 'Show photo'} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div style={backgroundMode !== 'style' ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
                        <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Style
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

                        {backgroundMode !== 'style' && (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-3 block">
                                Not used while background is set to {backgroundMode === 'poster' ? 'Show Poster' : 'Show Photos'} — image backgrounds always use a fixed high-contrast overlay for readability.
                            </PText>
                        )}
                    </div>

                    <PButton onClick={handleDownload} loading={generating} disabled={backgroundImageLoading} className="w-full">
                        {backgroundImageLoading ? 'Loading background…' : 'Download PNG'}
                    </PButton>
                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="block -mt-3">
                        On iPhone/iPad: Safari can't auto-download images — after generating, a full-size preview opens
                        below. Long-press it and tap "Save Image" instead.
                    </PText>
                </div>

                {/* Preview */}
                <div className="space-y-5">
                    <div className="flex items-start justify-center rounded-2xl border border-white/10 p-8" style={{ background: 'var(--p-color-canvas)' }}>
                        <div style={{ width: PREVIEW_WIDTH, height: previewHeight, overflow: 'hidden', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
                            <div style={{ width: POST_WIDTH, height: POST_HEIGHT, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                                <InstagramPostGraphic
                                    ref={graphicRef}
                                    show={show}
                                    styleKey={styleKey}
                                    liveDebutSongIds={liveDebutSongIds}
                                    tourDebutSongIds={tourDebutSongIds}
                                    backgroundMode={backgroundMode}
                                    backgroundImageUrl={backgroundImageDataUrl}
                                />
                            </div>
                        </div>
                    </div>

                    {photos.length > 0 && (
                        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'var(--p-color-surface)' }}>
                            <label className="block text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Uploaded Show Photos
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                {photos.map((photo, index) => (
                                    <button
                                        key={photo.id}
                                        type="button"
                                        onClick={() => setLightboxIndex(index)}
                                        className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-amber-500/40 transition-all"
                                    >
                                        <img
                                            src={photo.photo_url}
                                            alt={photo.caption || 'Show photo'}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-3 block">
                                Click a photo to view full size, then save it to use alongside the setlist graphic.
                            </PText>
                        </div>
                    )}
                </div>
            </div>

            <Lightbox
                open={lightboxIndex >= 0}
                close={() => setLightboxIndex(-1)}
                index={lightboxIndex}
                slides={photos.map(p => ({ src: p.photo_url, alt: p.caption || 'Show photo', title: p.caption }))}
            />

            {/* Generated-image preview — a plain <img> in a bare modal, NOT the
                yet-another-react-lightbox above. That library is built for
                browsing/swiping and disables the native long-press callout
                (and intercepts touch gestures) to do it, which is exactly
                what breaks "long-press to Save Image" on iOS here. */}
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
                        alt="Generated Instagram post"
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
