import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { useAuth } from '../../contexts/AuthContext';
import { getShowById, getShowDebuts } from '../../services/api';
import { buildShowPath } from '../../utils/showSlug';
import InstagramPostGraphic from '../../components/admin/InstagramPostGraphic';
import { POST_STYLES, POST_FORMATS, DEFAULT_STYLE_KEY, DEFAULT_FORMAT_KEY, getFormatByKey } from '../../utils/instagramStyles';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const PREVIEW_WIDTH = 380;

export default function InstagramPostPage() {
    const { id } = useParams();
    const { getToken } = useAuth();
    const [show, setShow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [formatKey, setFormatKey] = useState(DEFAULT_FORMAT_KEY);
    const [styleKey, setStyleKey] = useState(DEFAULT_STYLE_KEY);
    const [savedStyleKey, setSavedStyleKey] = useState(null);
    const [savingStyle, setSavingStyle] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [liveDebutSongIds, setLiveDebutSongIds] = useState(new Set());
    const [tourDebutSongIds, setTourDebutSongIds] = useState(new Set());

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

    // Load the style already assigned to this tour, if any
    useEffect(() => {
        if (!show?.tour_name) return;
        (async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/api/admin/tour-style/${encodeURIComponent(show.tour_name)}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data.style_key) {
                    setStyleKey(data.style_key);
                    setSavedStyleKey(data.style_key);
                }
            } catch (err) {
                console.error('[InstagramPostPage] Error loading tour style:', err);
            }
        })();
    }, [show?.tour_name, getToken]);

    const handleSaveStyleForTour = useCallback(async () => {
        if (!show?.tour_name) return;
        setSavingStyle(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/api/admin/tour-style/${encodeURIComponent(show.tour_name)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ style_key: styleKey }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setSavedStyleKey(styleKey);
        } catch (err) {
            console.error('[InstagramPostPage] Error saving tour style:', err);
            alert('Failed to save style for this tour');
        } finally {
            setSavingStyle(false);
        }
    }, [show?.tour_name, styleKey, getToken]);

    const handleDownload = useCallback(async () => {
        if (!graphicRef.current) return;
        setGenerating(true);
        try {
            await document.fonts.ready;
            const dataUrl = await toPng(graphicRef.current, { pixelRatio: 2, cacheBust: true });
            const link = document.createElement('a');
            const datePart = show.show_date;
            const artistPart = show.artist_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            link.download = `${datePart}-${artistPart}-setlist.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('[InstagramPostPage] Error generating image:', err);
            alert('Failed to generate image');
        } finally {
            setGenerating(false);
        }
    }, [show]);

    if (loading) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    if (error || !show) {
        return <PInlineNotification heading="Error" description={error || 'Show not found'} state="error" dismissButton={false} />;
    }

    const format = getFormatByKey(formatKey);
    const previewHeight = Math.round(PREVIEW_WIDTH * (format.height / format.width));
    const previewScale = PREVIEW_WIDTH / format.width;

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
                            Format
                        </label>
                        <div className="space-y-1.5">
                            {POST_FORMATS.map(f => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setFormatKey(f.key)}
                                    className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all ${
                                        formatKey === f.key
                                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                            : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                                    }`}
                                    style={formatKey !== f.key ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                                >
                                    {f.label} <span style={{ color: 'var(--p-color-contrast-low)' }}>({f.width}&times;{f.height})</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
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

                        {show.tour_name ? (
                            <div className="mt-3">
                                <PButtonPure
                                    size="x-small"
                                    disabled={savingStyle || savedStyleKey === styleKey}
                                    onClick={handleSaveStyleForTour}
                                >
                                    {savedStyleKey === styleKey
                                        ? `Saved as default for "${show.tour_name}"`
                                        : `Use for all "${show.tour_name}" posts`}
                                </PButtonPure>
                            </div>
                        ) : (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-3 block">
                                This show has no tour name, so the style choice won't be remembered.
                            </PText>
                        )}
                    </div>

                    <PButton onClick={handleDownload} loading={generating} className="w-full">
                        Download PNG
                    </PButton>
                </div>

                {/* Preview */}
                <div className="flex items-start justify-center rounded-2xl border border-white/10 p-8" style={{ background: 'var(--p-color-canvas)' }}>
                    <div style={{ width: PREVIEW_WIDTH, height: previewHeight, overflow: 'hidden', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
                        <div style={{ width: format.width, height: format.height, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                            <InstagramPostGraphic
                                ref={graphicRef}
                                show={show}
                                formatKey={formatKey}
                                styleKey={styleKey}
                                liveDebutSongIds={liveDebutSongIds}
                                tourDebutSongIds={tourDebutSongIds}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
