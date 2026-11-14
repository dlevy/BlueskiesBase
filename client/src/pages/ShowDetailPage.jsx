import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    PHeading, PText, PButtonPure, PTag, PSpinner,
    PInlineNotification
} from '@porsche-design-system/components-react';
import { getShowBySlug, getTourRarity, getShowDebuts, getAdjacentShows, getShowAttendees, checkShowAttendance, markShowAttended, unmarkShowAttended, getShowThanks, getShowPoster, getShowPhotos } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import { buildTourPath } from '../utils/tourSlug';
import { buildSongPath } from '../utils/songSlug';
import { assignSetlistDisplayNumbers } from '../utils/setlist';
import { useAuth } from '../contexts/AuthContext';
import { useAvatarNudge } from '../contexts/AvatarNudgeContext';
import CommentsSection from '../components/CommentsSection';
import ForumDiscussionBar from '../components/ForumDiscussionBar';
import WhoWasThereSection from '../components/WhoWasThereSection';
import PhotosSection from '../components/PhotosSection';
import PostersSection from '../components/PostersSection';
import SetlistSubmissionSection from '../components/SetlistSubmissionSection';
import SEO from '../components/SEO';
import { SITE_URL } from '../utils/siteUrl';
import MainNavTabs from '../components/MainNavTabs';

// A past show with no setlist yet is kept out of Google — thin content that
// dilutes the setlist pages. Upcoming shows stay indexed, and the cutoff
// trails today by a full day in UTC so a show is never hidden on its own
// night. Uses UTC (not the viewer's local date) so every visitor — and
// Googlebot — gets the same answer as the server. Mirrors isHiddenFromSearch
// in server/utils/showMeta.js — keep in sync.
const PREFETCH_WAIT_MS = 2500;
const TIMED_OUT = Symbol('timed out');
// Resolves to the promise's value, null if it rejects, or TIMED_OUT after ms.
function withTimeout(promise, ms) {
    return Promise.race([
        promise.catch(err => { console.error('[ShowDetail] prefetch failed:', err); return null; }),
        new Promise(resolve => setTimeout(() => resolve(TIMED_OUT), ms)),
    ]);
}

function isHiddenFromSearch(showDate, hasSetlist) {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    return !hasSetlist && showDate < cutoff;
}

function getYouTubeId(url) {
    try {
        const u = new URL(url);
        if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
        if (u.hostname.includes('youtube.com')) {
            if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
            return u.searchParams.get('v');
        }
    } catch {}
    return null;
}

// archive.org's embeddable player covers both audio-only and video items —
// identifier is the slug right after /details/ on a normal item page URL.
function getArchiveOrgId(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes('archive.org') && u.pathname.startsWith('/details/')) {
            return u.pathname.split('/')[2] || null;
        }
    } catch {}
    return null;
}

function isNugsLink(url) {
    try {
        return new URL(url).hostname.includes('nugs.net');
    } catch {
        return false;
    }
}

// nugs.net streams/sells recordings behind a paywall — there's nothing to
// embed, just a visual heads-up next to the link so it's clear before
// clicking through that it isn't free.
function NugsPaywallIcon() {
    return (
        <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
            title="Requires a paid nugs.net subscription or purchase to listen or download"
            role="img"
            aria-label="Requires a paid nugs.net subscription or purchase to listen or download"
        >
            <svg aria-hidden="true" className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 118 0v4" />
            </svg>
        </span>
    );
}

// Per-show setlist breakdown: album counts (each original attributed to its
// earliest-released album, so the breakdown sums to the total), covers, and
// rarity/debut counts using the same thresholds as the per-song badges below.
// Counts each unique song once regardless of how many times it was jammed
// back into during the show.
function computeSetlistStats(show, tourRarity, liveDebutSongIds, tourDebutSongIds) {
    if (!show?.setlist) return null;
    const allSongs = [
        ...(show.setlist.set1 || []),
        ...(show.setlist.set2 || []),
        ...(show.setlist.set3 || []),
        ...(show.setlist.encore || []),
    ];
    if (allSongs.length === 0) return null;

    const seen = new Set();
    const albumCounts = new Map();
    let otherOriginals = 0;
    let covers = 0;
    let teaseCount = 0;
    let rareCount = 0;
    let liveDebutCount = 0;
    let tourDebutCount = 0;

    allSongs.forEach(song => {
        if (!song.song_id || seen.has(song.song_id)) return;

        // A tease or DJ'd song isn't an actual performance of it, so it
        // shouldn't count toward Covers/Originals/the album breakdown — same
        // "doesn't count as the song being played" rule already applied to
        // Rare/Live Debut/Tour Debut just below. A tease still gets its own
        // honest count via teaseCount instead of silently vanishing from the
        // stats; a song whose only appearance here is DJ'd (no live
        // performance at all) doesn't get counted anywhere.
        if (song.performance_type === 'tease') {
            seen.add(song.song_id);
            teaseCount++;
            return;
        }
        if (song.performance_type === 'dj') {
            seen.add(song.song_id);
            return;
        }
        seen.add(song.song_id);

        // A real album_songs association wins regardless of is_original — a
        // cover that's an actual album track counts toward that album, not
        // the generic non-album-covers bucket, but tracked separately within
        // that album's own tally so its bar can show how much of it is
        // original vs. a cover of someone else's song. Only a song with no
        // album association at all falls through to otherOriginals/covers.
        const assocs = (song.songs?.album_songs || []).filter(as => as.albums);
        if (assocs.length > 0) {
            const primary = [...assocs].sort((a, b) => {
                const ra = a.albums?.release_date || '';
                const rb = b.albums?.release_date || '';
                if (!ra) return 1;
                if (!rb) return -1;
                return ra.localeCompare(rb);
            })[0];
            const title = primary.albums?.title || 'Other';
            const entry = albumCounts.get(title) || { original: 0, cover: 0 };
            if (song.is_original === false) entry.cover++; else entry.original++;
            albumCounts.set(title, entry);
        } else if (song.is_original === false) {
            covers++;
        } else if (song.is_original === true) {
            otherOriginals++;
        }

        // Matches SongRow below: a tease doesn't count as the song being
        // played, so it shouldn't earn Live Debut, Tour Debut or Rare —
        // keeps these tile totals consistent with which rows actually show
        // the badge.
        const tourCount = tourRarity?.total_shows > 0 ? tourRarity.song_counts[song.song_id] : undefined;
        if (tourCount != null && tourCount / tourRarity.total_shows < 0.15) rareCount++;

        if (liveDebutSongIds?.has(song.song_id)) liveDebutCount++;
        if (tourDebutSongIds?.has(song.song_id)) tourDebutCount++;
    });

    const albumBreakdown = [...albumCounts.entries()]
        .map(([title, { original, cover }]) => ({ title, count: original + cover, originalCount: original, coverCount: cover }))
        .sort((a, b) => b.count - a.count);

    return {
        totalSongs: seen.size,
        albumBreakdown,
        otherOriginals,
        covers,
        teaseCount,
        rareCount,
        liveDebutCount,
        tourDebutCount,
    };
}

// Which tags actually show up somewhere in this setlist — mirrors SongRow's
// own per-row conditions exactly (including the tease exclusion already
// used for Rare/Live Debut/Tour Debut there) so the legend only ever lists
// a tag the admin can actually point to in the list above it, never every
// possible tag regardless of whether this show uses it.
function computeLegendTags(songs, tourRarity, liveDebutSongIds, tourDebutSongIds) {
    const present = {
        tease: false, partial: false, dj: false, cover: false, sundayValley: false,
        liveDebut: false, tourDebut: false, rare: false, jamsInto: false,
    };
    songs.forEach(song => {
        if (song.performance_type === 'tease') present.tease = true;
        if (song.performance_type === 'partial') present.partial = true;
        if (song.performance_type === 'dj') present.dj = true;
        if (song.is_original === false) present.cover = true;
        if (song.is_sunday_valley) present.sundayValley = true;
        if (song.jams_into) present.jamsInto = true;

        const isTease = song.performance_type === 'tease';
        const tourCount = tourRarity?.total_shows > 0 && song.song_id ? tourRarity.song_counts[song.song_id] : undefined;
        if (!isTease && tourCount != null && tourCount / tourRarity.total_shows < 0.15) present.rare = true;
        if (!isTease && song.song_id != null && liveDebutSongIds?.has(song.song_id)) present.liveDebut = true;
        if (!isTease && song.song_id != null && tourDebutSongIds?.has(song.song_id)) present.tourDebut = true;
    });
    return present;
}

// Sample tag + plain-text definition, one row per tag actually present —
// same left-to-right order SongRow itself renders them in.
function SetlistLegend({ songs, tourRarity, liveDebutSongIds, tourDebutSongIds }) {
    const present = computeLegendTags(songs, tourRarity, liveDebutSongIds, tourDebutSongIds);
    const items = [
        present.tease && {
            tag: <InlineTag className="bg-amber-500/10 text-amber-400">tease</InlineTag>,
            text: "A brief, recognizable riff or musical phrase from the song — enough to tell what it is — without the band settling into it.",
        },
        present.partial && {
            tag: <InlineTag className="bg-amber-500/10 text-amber-400">partial</InlineTag>,
            text: 'The band plays at least one full section of the song (a verse, chorus, or passage) but not the whole thing, or plays the whole thing without the lyrics.',
        },
        present.dj && {
            tag: <InlineTag className="bg-purple-500/10 text-purple-300">DJ'd</InlineTag>,
            text: "Played as a recording over the PA — not performed live by the band.",
        },
        present.cover && {
            tag: <InlineTag className="bg-blue-500/10 text-blue-300">cover</InlineTag>,
            text: 'A song originally by another artist.',
        },
        present.sundayValley && {
            tag: <InlineTag className="bg-teal-500/10 text-teal-300">Sunday Valley</InlineTag>,
            text: "Written & originally performed by Sturgill's early band, Sunday Valley.",
        },
        present.liveDebut && {
            tag: <LiveDebutBadge />,
            text: 'First live performance of this song, ever.',
        },
        present.tourDebut && {
            tag: <TourDebutBadge />,
            text: 'First time this song has been played on this tour.',
        },
        present.rare && {
            tag: <RarePill />,
            text: 'Played at fewer than 15% of shows on this tour.',
        },
        present.jamsInto && {
            tag: <span className="font-bold text-amber-400 text-sm">→</span>,
            text: 'Transitions directly into the next song without stopping.',
        },
    ].filter(Boolean);

    if (items.length === 0) return null;

    return (
        <div className="mt-4 pt-4 border-t border-white/10">
            <PText size="xs" className="mb-2 block" style={{ color: 'var(--p-color-contrast-low)' }}>
                Tags in this setlist
            </PText>
            <div className="space-y-1.5">
                {items.map(({ tag, text }, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="shrink-0">{tag}</span>
                        <PText size="2xs" style={{ color: 'var(--p-color-contrast-low)' }}>{text}</PText>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatTile({ value, label, color }) {
    return (
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1">
            <span className="font-display font-bold text-sm" style={{ color }}>{value}</span>
            <span className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>{label}</span>
        </div>
    );
}

// The static pill part of RareBadge, reused as-is (no hover tooltip) by the
// Setlist legend, which already shows the definition as plain text.
function RarePill() {
    return (
        <span
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded cursor-default"
            style={{ background: 'rgba(192, 132, 252, 0.12)', color: '#c084fc' }}
        >
            <svg aria-hidden="true" className="w-2.5 h-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.456A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
            Rare
        </span>
    );
}

function RareBadge({ count, total, tourName }) {
    return (
        <div className="relative inline-flex group/rare">
            <RarePill />
            <div className="pointer-events-none absolute z-50 left-0 top-full mt-1.5
                            opacity-0 scale-95
                            group-hover/rare:opacity-100 group-hover/rare:scale-100
                            transition-all duration-100
                            w-52 rounded-xl border border-white/10 bg-[#0e1117] shadow-xl p-3">
                <div className="text-xs font-semibold" style={{ color: '#c084fc' }}>Rare</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    Played {count} of {total} shows on {tourName}
                </div>
            </div>
        </div>
    );
}

// Shared shape for the two debut badges — same "something new" visual language (star icon),
// differentiated by color/label: Live Debut (green) is the stronger, rarer claim — first
// performance ever, anywhere. Tour Debut (cyan) is an older song making its first
// appearance on this particular tour. A song only ever gets one or the other; the server
// already excludes live debuts from tour_debut_song_ids.
function DebutBadge({ label, color, title }) {
    return (
        <span
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded cursor-default"
            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
            title={title}
        >
            <svg aria-hidden="true" className="w-2.5 h-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a1 1 0 01.894.553l1.991 3.983 4.396.639a1 1 0 01.554 1.706l-3.182 3.1.751 4.378a1 1 0 01-1.451 1.054L10 15.347l-3.953 2.078a1 1 0 01-1.451-1.054l.751-4.378-3.182-3.1a1 1 0 01.554-1.706l4.396-.639L9.106 2.553A1 1 0 0110 2z" />
            </svg>
            {label}
        </span>
    );
}

const LiveDebutBadge = () => <DebutBadge label="Live Debut" color="#34d399" title="First live performance of this song, ever" />;
const TourDebutBadge = () => <DebutBadge label="Tour Debut" color="#22d3ee" title="First time this song has been played on this tour" />;

// Shared pill shape for the simpler tags (tease/partial/dj/cover/sunday
// valley) — a plain colored label with no icon or tooltip. Used both inline
// on a song row and, unchanged, as the sample tag in the Setlist legend.
function InlineTag({ className, children, title }) {
    return (
        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${className}`} title={title}>
            {children}
        </span>
    );
}

function SongRow({ song, position, tourRarity, liveDebutSongIds, tourDebutSongIds, showPosition = true }) {
    // A tease doesn't count as the song actually being played — Live Debut,
    // Tour Debut and Rare are all claims about a real performance, and a
    // tease shouldn't earn any of them just by teasing a song for the first
    // time (ever or this tour) or infrequently.
    const isTease = song.performance_type === 'tease';
    const tourCount = tourRarity?.total_shows > 0 && song.song_id
        ? tourRarity.song_counts[song.song_id]
        : undefined;
    const isRare = !isTease && tourCount != null && tourCount / tourRarity.total_shows < 0.15;
    const isLiveDebut = !isTease && song.song_id != null && liveDebutSongIds?.has(song.song_id);
    const isTourDebut = !isTease && song.song_id != null && tourDebutSongIds?.has(song.song_id);

    const hasLyrics = Boolean(song.lyrics?.trim());

    return (
        <li className="flex gap-3 py-0.5 items-start">
            {/* position is null for a jam's return to a song already numbered
                earlier in the same chain — left blank rather than renumbered,
                but the slot stays the same width so the title still lines up
                under every other title in the list. */}
            {showPosition && (
                <span className="shrink-0 w-6 text-right font-mono text-sm leading-relaxed font-bold text-amber-400">
                    {position ?? ''}
                </span>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {hasLyrics ? (
                        <Link
                            to={buildSongPath(song.title)}
                            title="View lyrics"
                            className="text-sm leading-relaxed font-semibold hover:underline"
                            style={{ color: 'var(--p-color-primary)' }}
                        >
                            {song.title}
                        </Link>
                    ) : (
                        <span className="text-sm leading-relaxed font-semibold" style={{ color: 'var(--p-color-primary)' }}>
                            {song.title}
                        </span>
                    )}
                    {song.performance_type === 'tease' && (
                        <InlineTag className="bg-amber-500/10 text-amber-400">tease</InlineTag>
                    )}
                    {song.performance_type === 'partial' && (
                        <InlineTag className="bg-amber-500/10 text-amber-400">partial</InlineTag>
                    )}
                    {song.performance_type === 'dj' && (
                        <InlineTag className="bg-purple-500/10 text-purple-300" title="DJ'd — played as a recording, not performed live">
                            DJ'd
                        </InlineTag>
                    )}
                    {song.is_original === false && (
                        <InlineTag className="bg-blue-500/10 text-blue-300">cover</InlineTag>
                    )}
                    {song.is_sunday_valley && (
                        <InlineTag className="bg-teal-500/10 text-teal-300" title="Written & originally performed by Sturgill's early band, Sunday Valley">
                            Sunday Valley
                        </InlineTag>
                    )}
                    {isLiveDebut && <LiveDebutBadge />}
                    {isTourDebut && <TourDebutBadge />}
                    {isRare && (
                        <RareBadge count={tourCount} total={tourRarity.total_shows} tourName={tourRarity.tour_name} />
                    )}
                    {song.jams_into && (
                        <span className="font-bold text-amber-400 text-sm">→</span>
                    )}
                </div>
                {(song.original_artist || song.notes?.length > 0) && (
                    <div className="mt-0.5 text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {song.original_artist && <div>({song.original_artist})</div>}
                        {song.notes?.filter(Boolean).map((note, i) => (
                            <div key={i} className="italic flex gap-1">
                                <span aria-hidden="true">&ndash;</span>
                                <span>{note}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </li>
    );
}

function SetList({ songs, tourRarity, liveDebutSongIds, tourDebutSongIds, showPosition = true }) {
    const rows = assignSetlistDisplayNumbers(songs);
    return (
        <ol className="space-y-1">
            {rows.map(({ song, position }, index) => (
                <SongRow
                    key={song.id || index}
                    song={song}
                    position={position}
                    tourRarity={tourRarity}
                    liveDebutSongIds={liveDebutSongIds}
                    tourDebutSongIds={tourDebutSongIds}
                    showPosition={showPosition}
                />
            ))}
        </ol>
    );
}

export default function ShowDetailPage() {
    const { artist, date, locationSlug } = useParams();
    const navigate = useNavigate();
    const { user, isEditorOrAdmin } = useAuth();
    const triggerAvatarNudge = useAvatarNudge();
    const [show, setShow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [attended, setAttended] = useState(false);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [tourRarity, setTourRarity] = useState(null);
    const [liveDebutSongIds, setLiveDebutSongIds] = useState(null);
    const [tourDebutSongIds, setTourDebutSongIds] = useState(null);
    const [adjacent, setAdjacent] = useState({ prev: null, next: null });
    const [thanksRows, setThanksRows] = useState([]);
    const [seoImageUrl, setSeoImageUrl] = useState(null);
    const initialLoad = useRef(true);
    // "Who Was There" list fetched together with the show (see fetchShow) so
    // it renders in the same paint as the header card instead of growing it
    // afterwards. null = not prefetched; WhoWasThereSection then loads it itself.
    const [initialAttendees, setInitialAttendees] = useState(null);
    // Which {artist, date, locationSlug} the current `show` state was actually
    // fetched for — not just whatever show_date happens to be on it. Two shows
    // sharing a date (e.g. an official show and its same-night afterparty) both
    // satisfy `show.show_date === date`, so that alone can't tell a genuinely
    // current show apart from a stale one left over from the previous show's
    // page while the new fetch is still in flight. Without this, clicking
    // Next/Prev between two same-day shows raced the canonical-redirect effect
    // below against the next fetch, bouncing the URL back and forth.
    const fetchedForRef = useRef(null);

    const loadThanks = useCallback(async () => {
        if (!show?.id) return;
        try {
            const { thanks } = await getShowThanks(show.id);
            setThanksRows(thanks || []);
        } catch (err) {
            console.error('[ShowDetail] thanks fetch failed:', err);
        }
    }, [show?.id]);

    useEffect(() => { loadThanks(); }, [loadThanks]);

    // An image for this show's JSON-LD (schema.org MusicEvent.image, which
    // Google ties to Event rich-result eligibility) — the official poster if
    // one exists, else the earliest fan photo. Mirrors the same
    // poster-then-photo fallback server/utils/showMeta.js uses for the
    // server-side prerendered version of this same page.
    useEffect(() => {
        if (!show?.id) { setSeoImageUrl(null); return; }
        let cancelled = false;
        getShowPoster(show.id)
            .then(data => {
                if (cancelled) return null;
                const posters = data.posters || [];
                const primary = posters.find(p => !p.is_foil && p.is_primary) || posters[0] || null;
                if (primary) { setSeoImageUrl(primary.poster_url); return null; }
                return getShowPhotos(show.id);
            })
            .then(photoData => {
                if (cancelled || !photoData) return;
                setSeoImageUrl(photoData.photos?.[0]?.photo_url || null);
            })
            .catch(err => console.error('[ShowDetail] SEO image fetch failed:', err));
        return () => { cancelled = true; };
    }, [show?.id]);

    useEffect(() => {
        let cancelled = false;
        const fetchShow = async () => {
            try {
                if (initialLoad.current) setLoading(true);
                setError(null);
                setAdjacent({ prev: null, next: null });
                setTourRarity(null);
                setLiveDebutSongIds(null);
                setTourDebutSongIds(null);
                const data = await getShowBySlug(date, artist, locationSlug);
                if (cancelled) return;
                // The prev/next bar (above the header card) and the "Who Was
                // There" list (inside it) used to load after the page appeared,
                // pushing everything below them down — the show page's main
                // layout shift (CLS). Fetch both before revealing the page, but
                // never wait on them longer than PREFETCH_WAIT_MS: a slow one
                // falls back to arriving late rather than holding the page.
                const adjacentP = getAdjacentShows(data.id);
                const attendeesP = getShowAttendees(data.id);
                const [adj, att] = await Promise.all([
                    withTimeout(adjacentP, PREFETCH_WAIT_MS),
                    withTimeout(attendeesP, PREFETCH_WAIT_MS),
                ]);
                if (cancelled) return;
                if (adj === TIMED_OUT) {
                    adjacentP.then(d => { if (!cancelled) setAdjacent(d); }).catch(() => {});
                } else if (adj) {
                    setAdjacent(adj);
                }
                setInitialAttendees(att && att !== TIMED_OUT ? att : null);
                setShow(data);
                fetchedForRef.current = { artist, date, locationSlug };
            } catch (err) {
                if (cancelled) return;
                console.error('Error fetching show:', err);
                setError('Failed to load show details');
            } finally {
                if (cancelled) return;
                setLoading(false);
                initialLoad.current = false;
            }
        };
        fetchShow();
        return () => { cancelled = true; };
    }, [artist, date, locationSlug]);

    // Redirect to canonical URL if params don't match (e.g. old links).
    // Guard: skip until `show` was actually fetched for the CURRENT params —
    // comparing show_date alone isn't enough when two shows share a date (see
    // fetchedForRef above), since a stale same-day show would wrongly pass
    // that check and redirect back to its own URL mid-navigation.
    useEffect(() => {
        const fetchedFor = fetchedForRef.current;
        if (!show || !fetchedFor || fetchedFor.artist !== artist || fetchedFor.date !== date || fetchedFor.locationSlug !== locationSlug) return;
        const canonical = buildShowPath(show);
        const current = `/show/${artist}/${date}/${locationSlug}`;
        if (current !== canonical) {
            navigate(canonical, { replace: true });
        }
    }, [show, artist, date, locationSlug, navigate]);

    // Originals/Covers tag counts — computed during render rather than in an
    // effect, which set them one render after the page painted and popped the
    // tags into the header card a moment later (a small layout shift).
    const songStats = useMemo(() => {
        if (!show?.setlist) return { originals: 0, covers: 0 };
        const allSongs = [
            ...(show.setlist.set1 || []),
            ...(show.setlist.set2 || []),
            ...(show.setlist.set3 || []),
            ...(show.setlist.encore || [])
        ];
        const seen = new Set();
        let originals = 0, covers = 0;
        allSongs.forEach(song => {
            // A tease or DJ'd song isn't an actual performance of it, so it
            // shouldn't count toward Originals/Covers — same "doesn't count
            // as the song being played" rule applied everywhere else
            // (debuts, rarity, tour performance counts).
            if (!song.song_id || seen.has(song.song_id)) return;
            if (song.performance_type === 'tease' || song.performance_type === 'dj') return;
            seen.add(song.song_id);
            if (song.is_original === true) originals++;
            else covers++;
        });
        return { originals, covers };
    }, [show]);

    // Fetch tour rarity data once show is loaded and has a tour
    useEffect(() => {
        if (!show?.id || !show?.tour_name) return;
        getTourRarity(show.id)
            .then(data => setTourRarity(data))
            .catch(err => console.error('[ShowDetail] tour rarity fetch failed:', err));
    }, [show?.id, show?.tour_name]);

    // Fetch which songs in this show's setlist were live/tour debuts — unlike tour rarity
    // this doesn't require show?.tour_name up front, since a live debut is scoped to the
    // show itself (tour debuts simply come back empty when there's no tour_name).
    useEffect(() => {
        if (!show?.id) return;
        getShowDebuts(show.id)
            .then(data => {
                setLiveDebutSongIds(new Set(data.live_debut_song_ids || []));
                setTourDebutSongIds(new Set(data.tour_debut_song_ids || []));
            })
            .catch(err => console.error('[ShowDetail] debuts fetch failed:', err));
    }, [show?.id]);

    // Check attendance after show loads
    useEffect(() => {
        if (!user || !show?.id) return;
        const check = async () => {
            try {
                const { attended: isAttended } = await checkShowAttendance(show.id);
                setAttended(isAttended);
            } catch (err) {
                console.error('Error checking attendance:', err);
            }
        };
        check();
    }, [show?.id, user]);

    const handleAttendanceToggle = async () => {
        if (!user || !show) {
            alert('Please log in to mark shows as attended');
            return;
        }
        setAttendanceLoading(true);
        try {
            if (attended) {
                await unmarkShowAttended(show.id);
                setAttended(false);
            } else {
                await markShowAttended(show.id);
                setAttended(true);
                triggerAvatarNudge();
            }
        } catch (err) {
            console.error('Error toggling attendance:', err);
            alert(err.message || 'Failed to update attendance');
        } finally {
            setAttendanceLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto">
                <MainNavTabs />
                <div className="min-h-[60vh] flex items-center justify-center">
                    <PSpinner size="large" aria={{ 'aria-label': 'Loading show details' }} />
                </div>
            </div>
        );
    }

    if (error || !show) {
        return (
            <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto space-y-4">
                <MainNavTabs />
                <PInlineNotification
                    heading="Could not load show"
                    description={error || 'Show not found'}
                    state="error"
                    dismissButton={false}
                />
                <PButtonPure icon="arrow-left" onClick={() => navigate('/')}>
                    Back to Search
                </PButtonPure>
            </div>
        );
    }

    const formatDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        return new Date(year, month - 1, day).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    const venueName = show.venues?.name || '';
    const venueCity = show.venues
        ? [show.venues.city, show.venues.state, show.venues.country].filter(Boolean).join(', ')
        : '';
    const [syear, smonth, sday] = show.show_date.split('-');
    const showDateObj = new Date(syear, smonth - 1, sday);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isFutureShow = showDateObj >= today;
    const longDate = showDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // City folded into the title itself, not just the description — city-name
    // searches ("johnny blue skies [city] setlist") match against the title
    // tag far more reliably than body/meta text.
    const venueLabel = venueName && venueCity ? `${venueName}, ${venueCity}` : (venueName || venueCity);
    const seoTitle = show.is_cancelled
        ? `${show.artist_name} at ${venueLabel} – ${longDate} (Canceled)`
        : `${show.artist_name} at ${venueLabel} – ${longDate} Setlist`;
    const allSongsFlat = [
        ...(show.setlist?.set1 || []),
        ...(show.setlist?.set2 || []),
        ...(show.setlist?.set3 || []),
        ...(show.setlist?.encore || []),
    ];
    // Deliberately excluded from allSongsFlat/the SEO description/every stats
    // computation on this page — not performed during the show, same
    // treatment as a DJ'd song, just split into its own section instead of
    // flagged inline.
    const soundcheckSongs = show.setlist?.soundcheck || [];
    // Leads with the songs — Google shows the start of the description in
    // results. Skips DJ'd songs and teases, and lists a song jammed out of
    // and back into only once. Mirrors setlistPreview()/description in
    // server/utils/showMeta.js — keep in sync.
    const previewTitles = [...new Set(
        allSongsFlat
            .filter(s => s.title && s.performance_type !== 'dj' && s.performance_type !== 'tease')
            .map(s => s.title)
    )];
    const setlistPreview = previewTitles.length
        ? previewTitles.slice(0, 5).join(', ') + (previewTitles.length > 5 ? ', …' : '')
        : '';
    const seoDescription = show.is_cancelled
        ? `${show.artist_name} was scheduled to perform at ${venueName} in ${venueCity} on ${longDate}, but the show was canceled.`
        : (setlistPreview ? `Setlist: ${setlistPreview} — ` : '')
            + `${show.artist_name} performed at ${venueName} in ${venueCity} on ${longDate}.`
            + (show.tour_name ? ` Part of the ${show.tour_name} tour.` : '');
    // Keep in sync with server/utils/showMeta.js buildShowHead — that's what
    // crawlers actually see (prerendered into index.html for /show/* before
    // this client-side version would ever run); this copy covers in-app
    // client-side navigation between show pages.
    // No ticketing/promoter data exists in this archive, so `offers` and
    // `organizer` are deliberately omitted rather than fabricated. Tour name
    // is folded into the description text, not modeled as `subEvent` — that
    // nests a second `@type: Event` object which Google then validates
    // against the same required-fields rules, and a tour (spanning many
    // dates/venues) can never satisfy a single startDate/location.
    const musicEventJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'MusicEvent',
        name: `${show.artist_name} – ${venueName}`,
        startDate: show.show_date,
        endDate: show.show_date,
        eventStatus: show.is_cancelled ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        description: seoDescription,
        location: {
            '@type': 'MusicVenue',
            name: venueName,
            address: { '@type': 'PostalAddress', addressLocality: show.venues?.city, addressRegion: show.venues?.state, addressCountry: show.venues?.country }
        },
        performer: { '@type': 'MusicGroup', name: show.artist_name },
        ...(seoImageUrl ? { image: seoImageUrl } : {}),
    };

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
            ...(show.tour_name ? [{ '@type': 'ListItem', position: 2, name: show.tour_name, item: `${SITE_URL}${buildTourPath(show.tour_name)}` }] : []),
            {
                '@type': 'ListItem',
                position: show.tour_name ? 3 : 2,
                name: seoTitle,
                item: `${SITE_URL}${buildShowPath(show)}`,
            },
        ],
    };

    // One VideoObject per embedded YouTube link below (Videos & Links
    // section) — mirrors server/utils/showMeta.js's buildVideoJsonLd. Google
    // requires `uploadDate`, so only videos whose real YouTube publish date
    // was fetched on save (server/utils/youtube.js) are described.
    const videoJsonLd = (show.links || [])
        .map(link => ({ link, ytId: getYouTubeId(link.url) }))
        .map(({ link, ytId }) => ({
            link, ytId,
            uploadDate: ytId && link.upload_date && link.upload_video_id === ytId ? link.upload_date : null,
        }))
        .filter(({ uploadDate }) => uploadDate)
        .map(({ link, ytId, uploadDate }) => ({
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            name: link.description
                ? `${link.description} — ${show.artist_name} Live at ${venueLabel}`
                : `${show.artist_name} Live at ${venueLabel} — ${longDate}`,
            description: `Fan-recorded video from ${show.artist_name}'s show at ${venueLabel} on ${longDate}.`
                + (link.description ? ` ${link.description}` : ''),
            thumbnailUrl: [
                `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
                `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
            ],
            uploadDate,
            embedUrl: `https://www.youtube.com/embed/${ytId}`,
            url: link.url,
        }));

    const attendanceLabel = show.is_cancelled
        ? (attended ? 'I Planned to Go' : 'Planned to Go')
        : attended
            ? (isFutureShow ? "I'm Attending" : 'I Was There')
            : (isFutureShow ? 'Attending' : 'Attended');
    const attendanceIcon = attended ? 'check' : 'plus';

    const setlistStats = computeSetlistStats(show, tourRarity, liveDebutSongIds, tourDebutSongIds);

    return (
        <div className="px-4 py-8 max-w-4xl mx-auto space-y-6">
            <SEO
                title={seoTitle}
                description={seoDescription}
                jsonLd={[musicEventJsonLd, breadcrumbJsonLd, ...videoJsonLd]}
                path={buildShowPath(show)}
                noindex={isHiddenFromSearch(show.show_date, allSongsFlat.length > 0)}
            />

            <MainNavTabs />

            {/* Prev / Next show navigation */}
            {(adjacent.prev || adjacent.next) && (
                <div className="flex items-center justify-between gap-4">
                    {adjacent.prev ? (
                        <button
                            onClick={() => navigate(buildShowPath(adjacent.prev))}
                            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                        >
                            <svg aria-hidden="true" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>
                                <span className="block text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>Previous Show</span>
                                <span>
                                    {new Date(adjacent.prev.show_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {/* Same date as the current show — a plain date here would look like
                                        nothing changed, so name the venue/artist to make it clear it's a
                                        different show (e.g. a same-night afterparty). */}
                                    {adjacent.prev.show_date === show.show_date && (adjacent.prev.venues?.city || adjacent.prev.artist_name !== show.artist_name) && (
                                        <> &middot; {adjacent.prev.artist_name !== show.artist_name ? adjacent.prev.artist_name : adjacent.prev.venues?.city}</>
                                    )}
                                </span>
                            </span>
                        </button>
                    ) : <div />}
                    {adjacent.next ? (
                        <button
                            onClick={() => navigate(buildShowPath(adjacent.next))}
                            className="flex items-center gap-2 text-sm text-right transition-opacity hover:opacity-80"
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                        >
                            <span>
                                <span className="block text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>Next Show</span>
                                <span>
                                    {new Date(adjacent.next.show_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {adjacent.next.show_date === show.show_date && (adjacent.next.venues?.city || adjacent.next.artist_name !== show.artist_name) && (
                                        <> &middot; {adjacent.next.artist_name !== show.artist_name ? adjacent.next.artist_name : adjacent.next.venues?.city}</>
                                    )}
                                </span>
                            </span>
                            <svg aria-hidden="true" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : <div />}
                </div>
            )}

            {/* Show header */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-8">
                {/* Artist name + attendance button */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <h1 className="font-display font-bold text-2xl md:text-4xl leading-tight min-w-0 flex items-center flex-wrap gap-2.5" style={{ color: 'var(--p-color-primary)' }}>
                        {show.artist_name}
                        {show.is_cancelled && (
                            <span className="shrink-0 text-xs md:text-sm font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 align-middle">
                                Canceled
                            </span>
                        )}
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap">
                    {isEditorOrAdmin && (
                        <button
                            onClick={() => navigate(`/admin/shows/edit/${show.id}`)}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all"
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                        >
                            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                        </button>
                    )}
                    {isEditorOrAdmin && (
                        <button
                            onClick={() => navigate(`/admin/shows/${show.id}/instagram`)}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all"
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                        >
                            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            IG
                        </button>
                    )}
                    <button
                        onClick={() => navigate(`/artwork/${show.id}`)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all"
                        style={{ color: 'var(--p-color-contrast-medium)' }}
                    >
                        <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v14H4V5zm0 10l4.5-4.5 3 3L16 9l4 4" />
                            <circle cx="8.5" cy="8.5" r="1.25" />
                        </svg>
                        Artwork
                    </button>
                    {user && (
                        <button
                            onClick={handleAttendanceToggle}
                            disabled={attendanceLoading}
                            className={`shrink-0 inline-flex items-center gap-2 h-8 px-4 rounded-lg text-sm font-semibold border transition-all ${
                                attended
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/18'
                                    : 'border-white/15 hover:border-white/25 hover:bg-white/5'
                            } ${attendanceLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            style={!attended ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                        >
                            {attendanceLoading ? (
                                <svg aria-hidden="true" className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            ) : (
                                <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{attended ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />}</svg>
                            )}
                            {attendanceLabel}
                        </button>
                    )}
                    </div>
                </div>

                {/* Date */}
                <div className="mt-5">
                    <div className="flex items-baseline gap-2.5">
                        <span className={`font-display font-bold text-3xl leading-none ${show.is_cancelled ? 'text-red-400/70' : 'text-amber-400'}`}>
                            {parseInt(sday, 10)}
                        </span>
                        <span className="font-semibold" style={{ color: 'var(--p-color-primary)' }}>
                            {showDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {showDateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                    </p>
                </div>

                {/* Venue */}
                {show.venues && (
                    <div className="mt-4">
                        <div className="font-semibold" style={{ color: 'var(--p-color-primary)' }}>
                            {show.venues.name}
                        </div>
                        <div className="text-sm mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            {venueCity}
                        </div>
                        {show.venues.address && (
                            <div className="text-xs mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>
                                {show.venues.address}
                            </div>
                        )}
                    </div>
                )}

                {/* Support act context */}
                {show.opened_for && (
                    <div className="mt-4 flex flex-col gap-1.5">
                        <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            <span style={{ color: 'var(--p-color-contrast-low)' }}>Opening for </span>
                            <span className="font-semibold" style={{ color: 'var(--p-color-primary)' }}>{show.opened_for.name}</span>
                        </p>
                    </div>
                )}

                {/* Tags + Sources */}
                {(show.tour_name || songStats.originals > 0 || songStats.covers > 0 || show.source_types?.length > 0) && (
                    <div className="mt-5 pt-4 border-t border-white/[0.07] flex flex-wrap items-center gap-2">
                        {show.tour_name && (
                            <Link to={buildTourPath(show.tour_name)} className="transition-opacity hover:opacity-80">
                                <PTag icon="arrow-right">{show.tour_name}</PTag>
                            </Link>
                        )}
                        {songStats.originals > 0 && (
                            <PTag color="notification-success-soft">
                                {songStats.originals} Original{songStats.originals !== 1 ? 's' : ''}
                            </PTag>
                        )}
                        {songStats.covers > 0 && (
                            <PTag color="notification-info-soft">
                                {songStats.covers} Cover{songStats.covers !== 1 ? 's' : ''}
                            </PTag>
                        )}
                        {show.source_types?.map((source, i) => <PTag key={i}>{source}</PTag>)}
                    </div>
                )}

                {/* Notes */}
                {show.notes && (
                    <div className="mt-5 pt-4 border-t border-white/[0.07]">
                        <PText size="small" color="contrast-medium">{show.notes}</PText>
                    </div>
                )}

                {/* Who Was There */}
                <WhoWasThereSection key={show.id} initial={initialAttendees} showId={show.id} refreshOn={attended} isFutureShow={isFutureShow} isCancelled={show.is_cancelled} />
            </div>

            {/* Sound Check — shown above the Setlist card, only when there's anything
                to show. Not counted toward stats (see soundcheckSongs above). No
                position numbers (soundcheck order isn't meaningful), and tourRarity/
                liveDebutSongIds/tourDebutSongIds are deliberately omitted — those
                badges are computed per song_id, not per-row, so passing them here
                would wrongly tag a soundcheck row with rare/debut status earned by
                that song's real setlist performance. Cover/Sunday Valley badges are
                intrinsic to the song itself, so those still show as normal. */}
            {soundcheckSongs.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                    <div className="flex items-baseline justify-between mb-6">
                        <PHeading size="large" tag="h2">Sound Check</PHeading>
                        <span className="text-xs font-display" style={{ color: 'var(--p-color-contrast-low)' }}>
                            {soundcheckSongs.length} songs
                        </span>
                    </div>
                    <SetList songs={soundcheckSongs} showPosition={false} />
                    <PText size="xs" className="mt-4 pt-4 border-t border-white/10 block" style={{ color: 'var(--p-color-contrast-low)' }}>
                        Sound check songs aren't counted as songs you've seen live.
                    </PText>
                </div>
            )}

            {/* Setlist */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                <div className="flex items-baseline justify-between mb-6">
                    <PHeading size="large" tag="h2">Setlist</PHeading>
                    {allSongsFlat.length > 0 && (
                        <span className="text-xs font-display" style={{ color: 'var(--p-color-contrast-low)' }}>
                            {allSongsFlat.length} songs
                        </span>
                    )}
                </div>

                {allSongsFlat.length > 0 ? (
                    <>
                        <SetList
                            songs={allSongsFlat}
                            tourRarity={tourRarity}
                            liveDebutSongIds={liveDebutSongIds}
                            tourDebutSongIds={tourDebutSongIds}
                        />
                        {allSongsFlat.some(s => s.performance_type === 'dj') && (
                            <PText size="xs" className="mt-4 pt-4 border-t border-white/10 block" style={{ color: 'var(--p-color-contrast-low)' }}>
                                DJ'd songs aren't counted as songs you've seen live, but attending this show still counts toward your total shows.
                            </PText>
                        )}
                        <SetlistLegend
                            songs={allSongsFlat}
                            tourRarity={tourRarity}
                            liveDebutSongIds={liveDebutSongIds}
                            tourDebutSongIds={tourDebutSongIds}
                        />
                    </>
                ) : show.is_cancelled ? (
                    <PText color="contrast-medium">This show was canceled.</PText>
                ) : (
                    <PText color="contrast-medium">
                        No official setlist yet.{' '}
                        {user ? (
                            <a href="#community-setlist" className="text-amber-400 hover:underline">Add what you remember</a>
                        ) : (
                            <>
                                <Link to="/member-login" className="text-amber-400 hover:underline">Log in</Link> to add what you remember
                            </>
                        )}
                        {' '}below.
                    </PText>
                )}
            </div>

            {/* Setlist Stats — only once a setlist actually exists */}
            {setlistStats && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                    <PHeading size="large" tag="h2">Setlist Stats</PHeading>
                    <div className="mt-6 space-y-5">
                        <div className="space-y-2">
                            {(() => {
                                const bars = [
                                    ...setlistStats.albumBreakdown,
                                    ...(setlistStats.otherOriginals > 0 ? [{ title: 'Other', count: setlistStats.otherOriginals, originalCount: setlistStats.otherOriginals, coverCount: 0 }] : []),
                                    ...(setlistStats.covers > 0 ? [{ title: 'Non-Album Covers', count: setlistStats.covers, originalCount: 0, coverCount: setlistStats.covers, isCover: true }] : []),
                                ].sort((a, b) => b.count - a.count);
                                const maxCount = Math.max(...bars.map(b => b.count));
                                return bars.map(({ title, count, originalCount, coverCount, isCover }) => (
                                    <div key={title}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs w-40 sm:w-56 shrink-0 truncate text-right" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                                {title}
                                            </span>
                                            {/* Split into an amber (original) and blue (cover) segment,
                                                side by side — an album bar isn't just one color, since a
                                                cover that's an actual track on that album (e.g. Mutiny
                                                After Midnight) still shows as its own blue sliver within
                                                that album's bar rather than being indistinguishable from
                                                the album's original songs. */}
                                            <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden flex">
                                                {originalCount > 0 && (
                                                    <div
                                                        className="h-full bg-amber-400/80 transition-all duration-700"
                                                        style={{ width: `${(originalCount / maxCount) * 100}%` }}
                                                    />
                                                )}
                                                {coverCount > 0 && (
                                                    <div
                                                        className="h-full bg-blue-400/70 transition-all duration-700"
                                                        style={{ width: `${(coverCount / maxCount) * 100}%` }}
                                                    />
                                                )}
                                            </div>
                                            <span className="text-xs w-4 shrink-0" style={{ color: 'var(--p-color-contrast-medium)' }}>{count}</span>
                                        </div>
                                        {isCover && (
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="w-40 sm:w-56 shrink-0" />
                                                <p className="text-xs italic flex-1" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                    A cover on an official album shows as the blue portion of that album's bar instead.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ));
                            })()}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {setlistStats.teaseCount > 0 && (
                                <StatTile value={setlistStats.teaseCount} label="Teases" color="#fbbf24" />
                            )}
                            {tourRarity && (
                                <StatTile value={setlistStats.rareCount} label="Rare Songs" color="#c084fc" />
                            )}
                            <StatTile value={setlistStats.tourDebutCount} label="Tour Debuts" color="#22d3ee" />
                            <StatTile value={setlistStats.liveDebutCount} label="Live Debuts" color="#34d399" />
                        </div>
                    </div>
                </div>
            )}

            <PhotosSection showId={show.id} thanksRows={thanksRows} onThanksChanged={loadThanks} />
            <PostersSection showId={show.id} showDate={show.show_date} />

            {/* Videos & Links */}
            {show.links?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-10">
                    <PHeading size="large" tag="h2">Videos &amp; Links</PHeading>
                    <div className="mt-6 space-y-8">
                        {show.links.map((link, i) => {
                            const ytId = getYouTubeId(link.url);
                            const archiveId = getArchiveOrgId(link.url);

                            if (ytId) {
                                return (
                                    <div key={i}>
                                        {link.description && (
                                            <p className="text-sm mb-3" style={{ color: 'var(--p-color-contrast-medium)' }}>{link.description}</p>
                                        )}
                                        <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: '56.25%' }}>
                                            <iframe
                                                className="absolute inset-0 w-full h-full"
                                                src={`https://www.youtube.com/embed/${ytId}`}
                                                title={link.description || 'YouTube video'}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        </div>
                                    </div>
                                );
                            }

                            if (archiveId) {
                                return (
                                    <div key={i}>
                                        {link.description && (
                                            <p className="text-sm mb-3" style={{ color: 'var(--p-color-contrast-medium)' }}>{link.description}</p>
                                        )}
                                        <div className="w-full rounded-xl overflow-hidden" style={{ height: '29px' }}>
                                            <iframe
                                                className="w-full h-full"
                                                src={`https://archive.org/embed/${archiveId}`}
                                                title={link.description || 'Archive.org recording'}
                                                allow="autoplay"
                                                allowFullScreen
                                            />
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-amber-400 hover:underline break-all">
                                    {isNugsLink(link.url) ? <NugsPaywallIcon /> : <span className="shrink-0">→</span>}
                                    <span>{link.description || link.url}</span>
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}

            <ForumDiscussionBar showId={show.id} />

            <CommentsSection showId={show.id} thanksRows={thanksRows} onThanksChanged={loadThanks} />

            {/* Setlist Submission — suppressed for a canceled show with no setlist
                entered; there's nothing to submit corrections to for a show that
                never happened. A canceled show with a partial setlist already
                logged (e.g. cut short mid-set) still gets this tool normally. */}
            {!(show.is_cancelled && allSongsFlat.length === 0) && (
                // scroll-margin-top clears the sticky header (h-14) when jumped to via the anchor above
                <div id="community-setlist" style={{ scrollMarginTop: '4.5rem' }}>
                    <SetlistSubmissionSection
                        showId={show.id}
                        thanksRows={thanksRows}
                        onThanksChanged={loadThanks}
                        officialSongIds={new Set(allSongsFlat.map(s => s.song_id).filter(Boolean))}
                    />
                </div>
            )}
        </div>
    );
}
