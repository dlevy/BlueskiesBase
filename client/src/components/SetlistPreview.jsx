const LIVE_DEBUT_COLOR = '#34d399';
const TOUR_DEBUT_COLOR = '#22d3ee';

function DebutTag({ label, color }) {
    return (
        <span
            className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
        >
            {label}
        </span>
    );
}

function SongGroup({ songs, dotSeparated }) {
    return (
        <>
            {songs.map((song, i) => (
                <span key={song.song_id ?? `${song.title}-${i}`} className="inline-flex items-baseline gap-2">
                    <span style={{ color: 'var(--p-color-contrast-medium)' }}>{song.title}</span>
                    {i < songs.length - 1 && (
                        dotSeparated
                            ? <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.18)' }}>·</span>
                            : <span aria-hidden="true" style={{ color: 'var(--p-color-contrast-medium)' }}>,</span>
                    )}
                </span>
            ))}
        </>
    );
}

/**
 * Inline preview of a setlist, in the spirit of setlist.fm's search results. Renders
 * nothing when a show has no setlist — most shows in the archive don't have one yet, so
 * this has to disappear cleanly rather than leave an empty row.
 *
 * When the show has any live or tour debuts, they lead the preview as labeled groups —
 * "Live Debut: Song A, Song B" / "Tour Debut: Song C" — ahead of the regular song list,
 * and are never hidden behind "+N more" (surfacing them is the point). With no debuts,
 * this renders exactly the flat "Song A · Song B · +N more" list it always has.
 *
 * songs: ordered [{song_id, title}]. liveDebutIds/tourDebutIds: Set<song_id>.
 */
export default function SetlistPreview({ songs, total, liveDebutIds, tourDebutIds, max = 8, className = '' }) {
    if (!songs?.length) return null;

    // A song played, jammed into another song, then jammed back into itself shows up as
    // two rows for the same song_id within one show — collapse to first occurrence so a
    // preview never lists (or tags) the same title twice. `total` (a raw row count from
    // the caller) needs the same adjustment, or "+N more" would count a phantom song that
    // was actually just the sandwiched repeat we just removed.
    const rawCount = songs.length;
    const seenSongIds = new Set();
    songs = songs.filter(s => {
        if (seenSongIds.has(s.song_id)) return false;
        seenSongIds.add(s.song_id);
        return true;
    });
    const effectiveTotal = (total ?? rawCount) - (rawCount - songs.length);

    const liveDebuts = liveDebutIds?.size ? songs.filter(s => liveDebutIds.has(s.song_id)) : [];
    const liveDebutSet = new Set(liveDebuts.map(s => s.song_id));
    const tourDebuts = tourDebutIds?.size
        ? songs.filter(s => tourDebutIds.has(s.song_id) && !liveDebutSet.has(s.song_id))
        : [];
    const hasDebuts = liveDebuts.length > 0 || tourDebuts.length > 0;

    if (!hasDebuts) {
        const shown = songs.slice(0, max);
        const remaining = effectiveTotal - shown.length;
        return (
            <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-relaxed ${className}`}>
                <SongGroup songs={shown} dotSeparated />
                {remaining > 0 && (
                    <span className="font-medium" style={{ color: 'var(--p-color-contrast-low)' }}>
                        +{remaining} more
                    </span>
                )}
            </div>
        );
    }

    // Debuts are always shown in full; the regular list fills whatever budget is left.
    const debutSongIds = new Set([...liveDebuts, ...tourDebuts].map(s => s.song_id));
    const rest = songs.filter(s => !debutSongIds.has(s.song_id));
    const restBudget = Math.max(0, max - liveDebuts.length - tourDebuts.length);
    const shownRest = rest.slice(0, restBudget);
    const remaining = effectiveTotal - liveDebuts.length - tourDebuts.length - shownRest.length;

    return (
        <div className={`space-y-1 text-xs leading-relaxed ${className}`}>
            {liveDebuts.length > 0 && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <DebutTag label="Live Debut" color={LIVE_DEBUT_COLOR} />
                    <SongGroup songs={liveDebuts} />
                </div>
            )}
            {tourDebuts.length > 0 && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <DebutTag label="Tour Debut" color={TOUR_DEBUT_COLOR} />
                    <SongGroup songs={tourDebuts} />
                </div>
            )}
            {(shownRest.length > 0 || remaining > 0) && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <SongGroup songs={shownRest} dotSeparated />
                    {remaining > 0 && (
                        <span className="font-medium" style={{ color: 'var(--p-color-contrast-low)' }}>
                            +{remaining} more
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
