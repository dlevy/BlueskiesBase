import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getShowById, getShowPoster } from '../../services/api';
import { buildShowPath } from '../../utils/showSlug';
import { useAuth } from '../../contexts/AuthContext';
import ArtworkGraphic, { ARTWORK_SIZE } from '../../components/admin/ArtworkGraphic';
import useBackgroundImageDataUrl from '../../hooks/useBackgroundImageDataUrl';
import useGraphicPngExport from '../../hooks/useGraphicPngExport';

const PREVIEW_WIDTH = 380;
const DEFAULT_BG_URL = '/artwork-default-bg.png';

export default function ArtworkPage() {
    const { id } = useParams();
    const { isAdmin } = useAuth();
    const [show, setShow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [posters, setPosters] = useState([]);
    const [postersLoaded, setPostersLoaded] = useState(false);
    // null selectedPosterId = "Default Background"; otherwise the id of the
    // chosen poster. Defaults to the first poster once posters load, or stays
    // on the default background if the show has none.
    const [selectedPosterId, setSelectedPosterId] = useState(null);
    const [pickedDefaultExplicitly, setPickedDefaultExplicitly] = useState(false);
    // How visible the background image is against the solid black ground
    // behind it, as a percent — user-adjustable since the right amount is a
    // matter of taste per poster. Passed to ArtworkGraphic as
    // posterOpacity/100; text always renders at full opacity regardless.
    const [posterOpacity, setPosterOpacity] = useState(50);

    const graphicRef = useRef(null);

    useEffect(() => {
        getShowById(id)
            .then(data => setShow(data))
            .catch(err => {
                console.error('[ArtworkPage] Error loading show:', err);
                setError('Failed to load show');
            })
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        getShowPoster(id)
            .then(data => {
                const loaded = data.posters || [];
                setPosters(loaded);
                if (loaded.length > 0) setSelectedPosterId(loaded[0].id);
            })
            .catch(err => console.error('[ArtworkPage] Error loading posters:', err))
            .finally(() => setPostersLoaded(true));
    }, [id]);

    const usingDefaultBackground = pickedDefaultExplicitly || selectedPosterId == null;
    const selectedPoster = posters.find(p => p.id === selectedPosterId) || null;
    const rawBackgroundImageUrl = usingDefaultBackground ? DEFAULT_BG_URL : selectedPoster?.poster_url || null;
    const { dataUrl: backgroundImageDataUrl, loading: backgroundImageLoading } = useBackgroundImageDataUrl(rawBackgroundImageUrl);
    const { generating, generatedImageUrl, download, clearGeneratedImage } = useGraphicPngExport(graphicRef, backgroundImageDataUrl);

    const handleDownload = () => {
        const datePart = show.show_date;
        const artistPart = show.artist_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        download(`${datePart}-${artistPart}-artwork.png`);
    };

    if (!isAdmin) {
        return (
            <PText color="contrast-medium">
                The artwork tool is restricted to full admins.
            </PText>
        );
    }

    if (loading) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    if (error || !show) {
        return <PInlineNotification heading="Error" description={error || 'Show not found'} state="error" dismissButton={false} />;
    }

    const previewScale = PREVIEW_WIDTH / ARTWORK_SIZE;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <PHeading size="2xl" tag="h1">Artwork</PHeading>
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

                        {postersLoaded && posters.length === 0 && (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mb-2 block">
                                No poster uploaded for this show yet — using the default background.
                            </PText>
                        )}

                        {posters.length > 0 && (
                            <div className="grid grid-cols-4 gap-1.5 mb-2">
                                {posters.map(poster => (
                                    <button
                                        key={poster.id}
                                        type="button"
                                        onClick={() => { setSelectedPosterId(poster.id); setPickedDefaultExplicitly(false); }}
                                        className="aspect-square rounded-md overflow-hidden border-2 transition-all"
                                        style={{ borderColor: !usingDefaultBackground && selectedPosterId === poster.id ? '#f59e0b' : 'transparent' }}
                                    >
                                        <img src={poster.thumbnail_url || poster.poster_url} alt={poster.is_foil ? 'Foil poster' : 'Poster'} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setPickedDefaultExplicitly(true)}
                            className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all ${
                                usingDefaultBackground
                                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                    : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                            }`}
                            style={!usingDefaultBackground ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                        >
                            Default Background
                        </button>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Background Opacity
                            </label>
                            <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>{posterOpacity}%</span>
                        </div>
                        <input
                            type="range"
                            min={20}
                            max={80}
                            step={10}
                            value={posterOpacity}
                            onChange={e => setPosterOpacity(Number(e.target.value))}
                            className="w-full"
                        />
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
                <div className="flex items-start justify-center rounded-2xl border border-white/10 p-8" style={{ background: 'var(--p-color-canvas)' }}>
                    <div style={{ width: PREVIEW_WIDTH, height: PREVIEW_WIDTH, overflow: 'hidden', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
                        <div style={{ width: ARTWORK_SIZE, height: ARTWORK_SIZE, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                            <ArtworkGraphic ref={graphicRef} show={show} backgroundImageUrl={backgroundImageDataUrl} posterOpacity={posterOpacity / 100} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Generated-image preview — a plain <img> in a bare modal (see
                InstagramPostPage.jsx for why: iOS Safari needs a real <img> to
                long-press and "Save Image", which a swipe/zoom lightbox library
                would intercept). */}
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
                        alt="Generated artwork"
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
