import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PHeading, PText, PButton, PSpinner, PInlineNotification } from '@porsche-design-system/components-react';
import { getUserStats } from '../services/api';
import { buildTourMapImage } from '../components/ShowMapShare';
import { getHighestBadge, getHighestCommunityTier } from '../utils/badges';
import { POST_WIDTH, POST_HEIGHT } from '../utils/instagramStyles';
import { useAuth } from '../contexts/AuthContext';
import useBackgroundImageDataUrl from '../hooks/useBackgroundImageDataUrl';
import useGraphicPngExport from '../hooks/useGraphicPngExport';
import SocialCardGraphic from '../components/SocialCardGraphic';

const PREVIEW_WIDTH = 380;

// A member's own shareable stat card — their show map, avatar, fun numbers,
// earned badges, and rarest songs seen live, generated as a 1080x1350 PNG.
// Mirrors the Tour Stats / per-show Instagram post generators' page
// structure (preview + download, iOS long-press fallback) but with no
// controls at all — one card, built from the viewer's own data, no picker
// needed since there's nothing to choose between.
export default function SocialCardPage() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mapImageUrl, setMapImageUrl] = useState(null);
    const [mapLoading, setMapLoading] = useState(false);

    const graphicRef = useRef(null);

    useEffect(() => {
        if (!user) { navigate('/member-login'); return; }

        getUserStats()
            .then(setStats)
            .catch(err => {
                console.error('[SocialCardPage] Error loading stats:', err);
                setError(err.message || 'Failed to load your stats');
            })
            .finally(() => setLoading(false));
    }, [user, navigate]);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isUpcoming = (d) => { const [y, m, day] = d.split('-'); return new Date(y, m - 1, day) >= today; };
    const pastShows = stats ? stats.attendedShows.filter(s => !isUpcoming(s.show_date)) : [];
    const upcomingShows = stats ? stats.attendedShows.filter(s => isUpcoming(s.show_date)) : [];

    // The map is the card's backdrop — generated once stats are in, cached
    // in state so it isn't rebuilt on every render.
    useEffect(() => {
        if (!stats || mapImageUrl) return;
        let cancelled = false;
        setMapLoading(true);
        buildTourMapImage({ pastShows, upcomingShows, attendedLabel: 'Attended' })
            .then(url => { if (!cancelled) setMapImageUrl(url); })
            .catch(err => console.error('[SocialCardPage] Error building map:', err))
            .finally(() => { if (!cancelled) setMapLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stats]);

    const { dataUrl: avatarDataUrl } = useBackgroundImageDataUrl(profile?.avatar_url || null);
    const { generating, generatedImageUrl, download, clearGeneratedImage } = useGraphicPngExport(graphicRef, avatarDataUrl, 'social_card_download');

    const handleDownload = () => {
        download(`${profile?.username || 'my'}-skysets-card.png`);
    };

    if (loading) {
        return <div className="flex justify-center items-center py-16"><PSpinner size="large" /></div>;
    }

    if (error || !stats) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-8">
                <PInlineNotification heading="Error" description={error || 'Could not load your stats'} state="error" dismissButton={false} />
            </div>
        );
    }

    const highestBadge = getHighestBadge(pastShows.length);
    const highestCommunityTier = getHighestCommunityTier(stats.contributionCounts?.total ?? 0);
    const memberSinceYear = profile?.created_at ? new Date(profile.created_at).getFullYear() : null;
    const ready = !mapLoading && mapImageUrl;

    const previewHeight = Math.round(PREVIEW_WIDTH * (POST_HEIGHT / POST_WIDTH));
    const previewScale = PREVIEW_WIDTH / POST_WIDTH;

    return (
        <div className="px-4 pt-2 pb-8 max-w-2xl mx-auto space-y-6">
            <div>
                <PHeading size="2xl" tag="h1">My Social Card</PHeading>
                <PText size="small" color="contrast-medium">
                    Your own show map, stats, and badges — ready to share.
                </PText>
            </div>

            <div className="flex flex-col items-center gap-6">
                <div style={{ width: PREVIEW_WIDTH, height: previewHeight, overflow: 'hidden', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
                    <div style={{ width: POST_WIDTH, height: POST_HEIGHT, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                        {ready ? (
                            <SocialCardGraphic
                                ref={graphicRef}
                                mapImageUrl={mapImageUrl}
                                avatarDataUrl={avatarDataUrl}
                                displayName={profile?.display_name}
                                username={profile?.username}
                                memberSinceYear={memberSinceYear}
                                showsAttended={pastShows.length}
                                upcomingShows={upcomingShows.length}
                                songsSeenLive={stats.totalSongsSeen}
                                liveDebutsWitnessed={stats.liveDebutsWitnessed ?? 0}
                                citiesVisited={stats.funStats?.uniqueCities ?? 0}
                                highestBadge={highestBadge}
                                highestCommunityTier={highestCommunityTier}
                                rarestSongsSeen={stats.rarestSongsSeen || []}
                                rarestSongsSeenTiedNote={stats.rarestSongsSeenTiedNote}
                            />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <PSpinner size="medium" aria={{ 'aria-label': 'Building your map' }} />
                            </div>
                        )}
                    </div>
                </div>

                {pastShows.length === 0 && (
                    <PText size="small" color="contrast-medium" className="text-center">
                        Mark a few shows as attended first — your card looks a lot better with a map on it!
                    </PText>
                )}

                <PButton onClick={handleDownload} loading={generating} disabled={!ready} className="w-full max-w-xs">
                    {mapLoading ? 'Building your map…' : 'Download PNG'}
                </PButton>
                <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="text-center -mt-3">
                    On iPhone/iPad: Safari can't auto-download images — after generating, a full-size preview opens
                    below. Long-press it and tap "Save Image" instead.
                </PText>
            </div>

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
                        alt="My social card"
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
