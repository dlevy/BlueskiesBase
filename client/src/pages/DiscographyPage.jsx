import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { PSpinner, PText, PInlineNotification } from '@porsche-design-system/components-react';
import { getSongs } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';

const ALBUM_TYPE_LABELS = { studio: 'Studio', live: 'Live', compilation: 'Compilation', ep: 'EP' };

function albumYear(releaseDate) {
    return releaseDate ? releaseDate.split('-')[0] : '';
}

// show_date is a plain DATE string (YYYY-MM-DD) — parse the parts directly
// rather than `new Date(dateString)`, which reads it as UTC midnight and can
// print the wrong day in a timezone west of UTC.
function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CalendarIcon() {
    return (
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
        </svg>
    );
}

function SongRow({ song, expanded, onToggle }) {
    const hasLyrics = Boolean(song.lyrics?.trim());
    return (
        <li data-song-id={song.id} className="border-b border-white/5 last:border-b-0 scroll-mt-20">
            <button
                type="button"
                onClick={hasLyrics ? onToggle : undefined}
                disabled={!hasLyrics}
                className={`w-full flex items-center justify-between gap-3 py-2.5 text-left transition-colors ${hasLyrics ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'}`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--p-color-primary)' }}>
                        {song.title}
                    </span>
                    {song.is_sunday_valley && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 whitespace-nowrap shrink-0">
                            Sunday Valley
                        </span>
                    )}
                    {song.is_original === false && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 whitespace-nowrap shrink-0">
                            Cover{song.original_artist ? ` · ${song.original_artist}` : ''}
                        </span>
                    )}
                </div>
                {hasLyrics ? (
                    <span className="text-xs shrink-0" style={{ color: 'var(--p-color-info)' }}>
                        {expanded ? 'Hide lyrics' : 'Show lyrics'}
                    </span>
                ) : (
                    <span className="text-xs shrink-0" style={{ color: 'var(--p-color-contrast-low)' }}>
                        No lyrics yet
                    </span>
                )}
            </button>
            {/* Sibling of the button, not nested inside it — a <Link> renders an
                <a>, and nesting <a> inside <button> is invalid HTML. Grey
                throughout, not blue — blue is reserved for the lyrics toggle
                above, and a second blue link here read as visual noise. */}
            <div className="pb-2 px-1">
                {song.last_played_show ? (
                    <Link
                        to={buildShowPath(song.last_played_show)}
                        className="inline-flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--p-color-contrast-low)' }}
                        title={`Last played ${formatDate(song.last_played_show.show_date)}`}
                    >
                        <CalendarIcon />
                        {song.performance_count}×
                    </Link>
                ) : (
                    <span
                        className="inline-flex items-center gap-1 text-xs"
                        style={{ color: 'var(--p-color-contrast-low)' }}
                        title="No setlist in our records includes this song — it may still have been played before we started tracking, or at a show we don't have a setlist for"
                    >
                        <CalendarIcon />
                        No recorded performances
                    </span>
                )}
            </div>
            {expanded && hasLyrics && (
                <pre className="whitespace-pre-wrap font-sans text-sm pb-3 px-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    {song.lyrics}
                </pre>
            )}
        </li>
    );
}

export default function DiscographyPage() {
    const [searchParams] = useSearchParams();
    const targetSongId = searchParams.get('song');
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedSongId, setExpandedSongId] = useState(targetSongId || null);

    useEffect(() => {
        getSongs()
            .then(data => setSongs((data.songs || []).filter(s =>
                // Originals (wherever they appear), plus covers only when
                // they're an actual album track — not every song ever
                // covered live, which would be most of the catalog.
                s.is_original === true || (s.album_songs && s.album_songs.length > 0)
            )))
            .catch(err => {
                console.error('[DiscographyPage] Error fetching songs:', err);
                setError('Failed to load the discography. Please refresh the page.');
            })
            .finally(() => setLoading(false));
    }, []);

    // Deep link from a show page's lyrics icon (?song=<id>) — scroll to that
    // song once it's actually rendered (requestAnimationFrame rather than
    // immediately, so layout has settled after the loading spinner is gone).
    useEffect(() => {
        if (!targetSongId || loading) return;
        const raf = requestAnimationFrame(() => {
            document.querySelector(`[data-song-id="${targetSongId}"]`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return () => cancelAnimationFrame(raf);
    }, [targetSongId, loading]);

    const { albumGroups, otherSongs } = useMemo(() => {
        const groups = new Map();
        const other = [];

        songs.forEach(song => {
            // Show a song under every album it's officially on, not just one —
            // a Cuttin' Grass re-recording is still that album's own tracklist
            // entry, even though the same song is also on its original album.
            const assocs = (song.album_songs || []).filter(as => as.albums);
            if (assocs.length === 0) { other.push(song); return; }
            assocs.forEach(assoc => {
                const key = assoc.album_id;
                if (!groups.has(key)) groups.set(key, { album: assoc.albums, songs: [] });
                groups.get(key).songs.push({ ...song, track_order: assoc.track_order });
            });
        });

        const sortedGroups = [...groups.values()]
            .sort((a, b) => (b.album.release_date || '').localeCompare(a.album.release_date || ''))
            .map(g => ({
                ...g,
                songs: g.songs.sort((a, b) =>
                    (a.track_order ?? Infinity) - (b.track_order ?? Infinity) || a.title.localeCompare(b.title)
                ),
            }));

        other.sort((a, b) => a.title.localeCompare(b.title));

        return { albumGroups: sortedGroups, otherSongs: other };
    }, [songs]);

    const toggle = (songId) => setExpandedSongId(prev => (prev === songId ? null : songId));

    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-3xl mx-auto">
            <SEO
                title="Discography"
                description="Every Sturgill Simpson and Johnny Blue Skies album, grouped with its tracklist, including cover songs, with lyrics where available."
            />

            <MainNavTabs />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Discography
                </h1>
                <PText size="small" color="contrast-medium">
                    Every album's tracklist, including cover songs. Tap a song to view its lyrics.
                </PText>
            </div>

            {loading && (
                <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>
            )}

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            {!loading && !error && (
                <div className="space-y-6">
                    {albumGroups.map(({ album, songs: albumSongs }) => (
                        <div key={album.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                                <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--p-color-primary)' }}>
                                    {album.title}
                                </h2>
                                <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                    {albumYear(album.release_date)}
                                    {album.album_type && ALBUM_TYPE_LABELS[album.album_type]
                                        ? ` · ${ALBUM_TYPE_LABELS[album.album_type]}`
                                        : ''}
                                </span>
                            </div>
                            <ul>
                                {albumSongs.map(song => (
                                    <SongRow
                                        key={song.id}
                                        song={song}
                                        expanded={expandedSongId === song.id}
                                        onToggle={() => toggle(song.id)}
                                    />
                                ))}
                            </ul>
                        </div>
                    ))}

                    {otherSongs.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <h2 className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--p-color-primary)' }}>
                                Other Originals
                            </h2>
                            <ul>
                                {otherSongs.map(song => (
                                    <SongRow
                                        key={song.id}
                                        song={song}
                                        expanded={expandedSongId === song.id}
                                        onToggle={() => toggle(song.id)}
                                    />
                                ))}
                            </ul>
                        </div>
                    )}

                    {albumGroups.length === 0 && otherSongs.length === 0 && (
                        <PText color="contrast-medium">No songs found.</PText>
                    )}
                </div>
            )}
        </div>
    );
}
