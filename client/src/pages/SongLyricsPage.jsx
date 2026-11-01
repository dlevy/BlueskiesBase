import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PHeading, PText, PButtonPure, PSpinner, PInlineNotification } from '@porsche-design-system/components-react';
import { getSongs, getSongById } from '../services/api';
import { buildSongPath, slugify } from '../utils/songSlug';
import { buildShowPath } from '../utils/showSlug';
import SEO from '../components/SEO';
import MainNavTabs from '../components/MainNavTabs';

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function albumYear(releaseDate) {
    return releaseDate ? releaseDate.split('-')[0] : '';
}

// A song can officially appear on more than one release (e.g. a studio
// original later re-cut for a Cuttin' Grass volume) — list every one it's
// actually on, not just a single "primary" album, oldest release first.
function songAlbums(song) {
    return (song.album_songs || [])
        .map(as => as.albums)
        .filter(Boolean)
        .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''));
}

// Small colored pill, same shape as InlineTag in ShowDetailPage.jsx — not
// shared/exported from there since it's a handful of lines, same "don't
// force a shared abstraction" call made for every other tiny tag like this.
function Tag({ className, children }) {
    return (
        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${className}`}>
            {children}
        </span>
    );
}

// Public, SEO-indexable lyrics page for a single song — /songs/{slug}.
// Resolves the slug against real song titles (no dedicated DB column, same
// approach as show/tour page slugs) rather than trusting the URL param
// as-is. Server-side prerendering for crawlers lives in
// server/utils/songMeta.js / api/[...path].js — keep both in sync.
export default function SongLyricsPage() {
    const { songSlug } = useParams();
    const navigate = useNavigate();

    const [resolving, setResolving] = useState(true);
    const [song, setSong] = useState(null);
    const [notFound, setNotFound] = useState(false);

    const [detail, setDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(true);
    const [error, setError] = useState(null);

    // Resolve the slug against every real song title. A slug matching more
    // than one distinct song (e.g. two different songs both titled
    // "Machine Gun") is treated as not found rather than guessed at — same
    // posture as the show/tour slug collision handling.
    useEffect(() => {
        let cancelled = false;
        getSongs()
            .then(data => {
                if (cancelled) return;
                const normalizedSlug = slugify(songSlug);
                const matches = (data.songs || []).filter(s => slugify(s.title) === normalizedSlug);
                if (matches.length !== 1) {
                    if (matches.length > 1) {
                        console.warn(`[SongLyricsPage] Slug "${songSlug}" matches ${matches.length} distinct songs`);
                    }
                    setNotFound(true);
                } else {
                    setSong(matches[0]);
                }
            })
            .catch(err => {
                console.error('[SongLyricsPage] Error loading songs:', err);
                if (!cancelled) setNotFound(true);
            })
            .finally(() => { if (!cancelled) setResolving(false); });
        return () => { cancelled = true; };
    }, [songSlug]);

    // Canonical redirect once resolved, same shape as TourPage's.
    useEffect(() => {
        if (!song) return;
        const canonical = buildSongPath(song.title);
        if (canonical !== `/songs/${songSlug}`) {
            navigate(canonical, { replace: true });
        }
    }, [song, songSlug, navigate]);

    useEffect(() => {
        if (!song) return;
        let cancelled = false;
        setLoadingDetail(true);
        getSongById(song.id)
            .then(data => { if (!cancelled) setDetail(data); })
            .catch(err => {
                console.error('[SongLyricsPage] Error loading song detail:', err);
                if (!cancelled) setError('Failed to load performance history');
            })
            .finally(() => { if (!cancelled) setLoadingDetail(false); });
        return () => { cancelled = true; };
    }, [song]);

    if (resolving) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-3xl mx-auto">
                <MainNavTabs />
                <div className="min-h-[40vh] flex items-center justify-center">
                    <PSpinner size="large" aria={{ 'aria-label': 'Loading song' }} />
                </div>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-3xl mx-auto space-y-4">
                <SEO title="Song Not Found" noindex />
                <MainNavTabs />
                <PInlineNotification heading="Song not found" description="We couldn't find a song at this URL." state="error" dismissButton={false} />
                <PButtonPure icon="arrow-left" onClick={() => navigate('/discography')}>
                    Back to Discography
                </PButtonPure>
            </div>
        );
    }

    const hasLyrics = Boolean(song.lyrics?.trim());
    const isCover = song.is_original === false;
    const albums = songAlbums(song);
    const albumsText = albums.map(a => `${a.title} (${albumYear(a.release_date)})`).join(', ');
    const seoDescription = `Lyrics for "${song.title}"`
        + (isCover && song.original_artist ? ` (originally by ${song.original_artist})` : '')
        + (albums.length > 0 ? `, from ${albumsText}` : '')
        + `, performed live by Johnny Blue Skies & The Dark Clouds and Sturgill Simpson.`;

    const musicCompositionJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'MusicComposition',
        name: song.title,
        ...(hasLyrics ? { lyrics: { '@type': 'CreativeWork', text: song.lyrics } } : {}),
    };
    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${window.location.origin}/` },
            { '@type': 'ListItem', position: 2, name: 'Discography', item: `${window.location.origin}/discography` },
            { '@type': 'ListItem', position: 3, name: `${song.title} Lyrics`, item: `${window.location.origin}${buildSongPath(song.title)}` },
        ],
    };

    // total_performances already excludes dj/soundcheck (see GET /api/songs/:id)
    // — reuse the same filtered subset for first/most-recent so this section
    // stays consistent with that count.
    const realPerformances = (detail?.performances || []).filter(p => p.performance_type !== 'dj' && p.performance_type !== 'soundcheck');
    const mostRecent = realPerformances[0] || null;
    const first = realPerformances[realPerformances.length - 1] || null;

    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-3xl mx-auto space-y-6">
            {/* A real song with no lyrics transcribed yet has nothing worth
                ranking for — noindex rather than leaving it to compete with
                (or dilute) the real lyrics pages. */}
            <SEO
                title={`${song.title} Lyrics`}
                description={seoDescription}
                jsonLd={[musicCompositionJsonLd, breadcrumbJsonLd]}
                path={buildSongPath(song.title)}
                noindex={!hasLyrics}
            />

            <MainNavTabs />

            <div>
                <PHeading size="2xl" tag="h1">{song.title} Lyrics</PHeading>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                    {isCover && (
                        <Tag className="bg-blue-500/10 text-blue-300">
                            Cover{song.original_artist ? ` of ${song.original_artist}` : ''}
                        </Tag>
                    )}
                    {song.is_sunday_valley && (
                        <Tag className="bg-teal-500/10 text-teal-300">Sunday Valley</Tag>
                    )}
                </div>
                {albums.length > 0 && (
                    <PText size="small" color="contrast-medium" className="mt-2 block">
                        On {albumsText}
                    </PText>
                )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                {hasLyrics ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {song.lyrics}
                    </pre>
                ) : (
                    <PText color="contrast-medium">Lyrics not available yet.</PText>
                )}
            </div>

            {loadingDetail ? (
                <div className="flex justify-center py-6"><PSpinner size="medium" /></div>
            ) : error ? (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            ) : detail && detail.total_performances > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                    <PHeading size="large" tag="h2">Performance History</PHeading>
                    <PText size="small" color="contrast-medium" className="mt-1 block">
                        Played {detail.total_performances} time{detail.total_performances === 1 ? '' : 's'} live.
                    </PText>
                    <div className="mt-4 space-y-2 text-sm">
                        {first && (
                            <div>
                                <span style={{ color: 'var(--p-color-contrast-low)' }}>First played: </span>
                                <Link to={buildShowPath(first.shows)} className="hover:underline" style={{ color: 'var(--p-color-info)' }}>
                                    {formatDate(first.shows.show_date)}
                                </Link>
                            </div>
                        )}
                        {mostRecent && mostRecent !== first && (
                            <div>
                                <span style={{ color: 'var(--p-color-contrast-low)' }}>Most recent: </span>
                                <Link to={buildShowPath(mostRecent.shows)} className="hover:underline" style={{ color: 'var(--p-color-info)' }}>
                                    {formatDate(mostRecent.shows.show_date)}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            <PButtonPure icon="arrow-left" onClick={() => navigate('/discography')}>
                Back to Discography
            </PButtonPure>
        </div>
    );
}
