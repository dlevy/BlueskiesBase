// Candidate "stat cards" for the Tour Stats Instagram post generator — one
// card per entry, never all of them at once (see TourStatsPostPage). Each
// `compute(tourData)` takes exactly what fetchTourSongCounts() returns and
// produces plain data, never JSX, so TourStatGraphic stays a dumb renderer.
// Two shapes, picked via `type`:
//   - 'headline': { type, headline, headlineSize: 'number'|'text', detail, subdetail? }
//   - 'list':     { type, title, items: [{ label, value }], tiedNote?: { count, names? }, subdetail? }
// Either shape may instead be { type, disabled: true, disabledReason } when
// the tour has nothing to say for that stat (e.g. no rare songs logged yet),
// so the picker can grey it out with a reason instead of the graphic ever
// rendering blank/undefined text.

function formatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function venueLine(show) {
    if (!show?.venue) return show?.artistName || '';
    return `${show.venue.name} — ${show.venue.city}${show.venue.state_country ? ', ' + show.venue.state_country : ''}`;
}

// Display-only shortening for the Album Breakdown card — a long album
// title was wrapping to multiple lines in that list's single row. The real
// catalog title (used everywhere else on the site) is untouched; this only
// swaps what this one card prints.
const ALBUM_SHORT_TITLES = {
    'Metamodern Sounds in Country Music': 'Metamodern',
};
function shortAlbumTitle(title) {
    return ALBUM_SHORT_TITLES[title] || title;
}

// Shared by every ranked-list stat (Rarest Songs, Most-Played Opener/
// Closer): caps the visible rows at 6 so the card doesn't get too busy, but
// a plain slice(0, 6) would silently drop a song tied with the 6th-place
// entry — same count, arbitrarily excluded just because of where it fell
// in the sort. Instead, anything beyond the 6th row that's STILL tied with
// it is folded into a single "+N more tied" note: named individually (in a
// smaller font so it doesn't eat the card's space) when there are only a
// few, or just the count when there are too many to list without that note
// itself becoming the busy thing this was supposed to avoid.
const MAX_RANKED_ROWS = 6;
const MAX_TIED_NAMES_TO_LIST = 5;

function buildRankedList(sortedSongs, formatValue) {
    const shown = sortedSongs.slice(0, MAX_RANKED_ROWS);
    const items = shown.map(s => ({ label: s.title, value: formatValue(s) }));
    const cutoffCount = shown[shown.length - 1]?.count;
    const tiedBeyond = cutoffCount != null
        ? sortedSongs.slice(MAX_RANKED_ROWS).filter(s => s.count === cutoffCount)
        : [];
    const tiedNote = tiedBeyond.length > 0
        ? { count: tiedBeyond.length, names: tiedBeyond.length <= MAX_TIED_NAMES_TO_LIST ? tiedBeyond.map(s => s.title) : null }
        : null;
    return { items, tiedNote };
}

function computeMostPlayedPosition(songs, noun) {
    if (!songs?.length) return { type: 'list', disabled: true, disabledReason: `No ${noun}s logged yet` };
    const { items, tiedNote } = buildRankedList(songs, s => `${s.count} show${s.count !== 1 ? 's' : ''}`);
    return {
        type: 'list',
        title: `Most-Played ${noun[0].toUpperCase()}${noun.slice(1)}s`,
        items,
        tiedNote,
    };
}

export const TOUR_STAT_TYPES = [
    {
        key: 'liveDebuts',
        label: 'Live Debuts',
        compute(tourData) {
            const { liveDebuts } = tourData;
            if (!liveDebuts?.length) return { type: 'headline', disabled: true, disabledReason: 'No live debuts yet' };
            const names = liveDebuts.map(d => d.title);
            return {
                type: 'headline',
                headline: String(liveDebuts.length),
                headlineSize: 'number',
                detail: 'Live Debuts on This Tour',
                subdetail: names.length <= 6 ? names.join(' · ') : undefined,
            };
        },
    },
    {
        key: 'rarestSongs',
        label: 'Rarest Songs',
        compute(tourData) {
            const { songCounts, showsWithSetlist, totalShows } = tourData;
            if (!songCounts?.length) return { type: 'list', disabled: true, disabledReason: 'No songs played yet' };
            const rarestSorted = [...songCounts].sort((a, b) => a.count - b.count || a.title.localeCompare(b.title));
            // A song played exactly once also names the actual date — that's
            // the interesting fact for a one-off, not just the count.
            // Ambiguous for 2+ shows (multiple dates), so those stay as a
            // plain count.
            const { items, tiedNote } = buildRankedList(rarestSorted, s =>
                s.count === 1 && s.showDates?.[0] ? `1 show · ${formatDateShort(s.showDates[0])}` : `${s.count} shows`
            );
            return {
                type: 'list',
                title: 'Rarest Songs for This Tour',
                items,
                tiedNote,
                subdetail: showsWithSetlist > 0 ? `${showsWithSetlist} of ${totalShows} shows played` : undefined,
            };
        },
    },
    {
        key: 'mostPlayed',
        label: 'Most-Played Song',
        compute(tourData) {
            const { songCounts, totalShows } = tourData;
            if (!songCounts?.length) return { type: 'list', disabled: true, disabledReason: 'No songs played yet' };
            const { items, tiedNote } = buildRankedList(songCounts, s => `${s.count} of ${totalShows} shows`);
            return {
                type: 'list',
                title: 'Most-Played Songs',
                items,
                tiedNote,
            };
        },
    },
    {
        key: 'mostPlayedOpener',
        label: 'Most-Played Opener',
        compute(tourData) {
            return computeMostPlayedPosition(tourData.openingSongs, 'opener');
        },
    },
    {
        key: 'mostPlayedCloser',
        label: 'Most-Played Closer',
        compute(tourData) {
            return computeMostPlayedPosition(tourData.closingSongs, 'closer');
        },
    },
    {
        key: 'biggestSetlist',
        label: 'Biggest Setlist',
        compute(tourData) {
            const show = tourData.biggestSetlist;
            if (!show) return { type: 'headline', disabled: true, disabledReason: 'No setlists logged yet' };
            return {
                type: 'headline',
                headline: `${show.songCount} songs`,
                headlineSize: 'number',
                // Deliberately "most songs," never "longest" — this app has no
                // set-length/time data, so "longest" would misread as duration.
                detail: 'the most of any show this tour',
                subdetail: `${venueLine(show)} — ${formatDateShort(show.showDate)}`,
            };
        },
    },
    {
        key: 'albumBreakdown',
        label: 'Album Breakdown',
        compute(tourData) {
            const { albumBreakdown, otherOriginals, covers } = tourData;
            const bars = [
                ...(albumBreakdown || []),
                ...(otherOriginals > 0 ? [{ title: 'Other Originals', count: otherOriginals }] : []),
                // "Other" here means the same thing it does for Other
                // Originals above: a cover that's also an actual album
                // track (e.g. one of the covers on Mutiny After Midnight)
                // is already counted under that album's own bucket, not
                // here — this is only covers with no album association at
                // all. Labeling it plain "Covers" reads as the complete
                // cover total, which it deliberately isn't.
                ...(covers > 0 ? [{ title: 'Non-Album Covers', count: covers }] : []),
            ].sort((a, b) => b.count - a.count);
            if (bars.length === 0) return { type: 'list', disabled: true, disabledReason: 'No songs played yet' };
            // Percentage of ALL plays (not just the shown top 6), so it
            // reads as each bucket's true share of the tour, not just its
            // share among whatever made the cut.
            const totalPlays = bars.reduce((sum, b) => sum + b.count, 0);
            return {
                type: 'list',
                title: 'Album Breakdown',
                // Capped at 6, not more — the bigger type this card uses to
                // avoid looking sparse (see TourStatGraphic) needs the room;
                // most tours only have a handful of meaningfully-sized
                // album buckets anyway.
                items: bars.slice(0, 6).map(b => ({
                    label: shortAlbumTitle(b.title),
                    value: `${totalPlays > 0 ? Math.round((b.count / totalPlays) * 100) : 0}% (${b.count})`,
                })),
            };
        },
    },
    {
        key: 'songCountByAlbum',
        label: 'Most-Played from Album',
        // The only stat here that needs a second choice beyond the tour
        // itself — TourStatsPostPage shows an album picker only when this
        // is selected, and calls compute(tourData, albumTitle). isAvailable
        // gates the stat-picker BUTTON (is there any album to even choose
        // from), which is deliberately separate from compute()'s own
        // `disabled` (which fires whenever no album is picked YET) — if
        // they were the same check, the button would grey itself out the
        // moment nothing was selected, and there'd be no way to click it to
        // reach the album picker in the first place.
        needsAlbum: true,
        isAvailable(tourData) {
            return (tourData.albumBreakdown?.length || 0) > 0;
        },
        compute(tourData, albumTitle) {
            if (!albumTitle) return { type: 'list', disabled: true, disabledReason: 'Pick an album above' };
            const songs = tourData.songsByAlbum?.[albumTitle];
            if (!songs?.length) return { type: 'list', disabled: true, disabledReason: 'No songs from this album were played on this tour' };
            const { items, tiedNote } = buildRankedList(songs, s => `${s.count} show${s.count !== 1 ? 's' : ''}`);
            return {
                type: 'list',
                title: `Most Played from ${shortAlbumTitle(albumTitle)}`,
                items,
                tiedNote,
            };
        },
    },
    {
        key: 'rarestSongsByAlbum',
        label: 'Least-Played from Album',
        // Same album picker/selection as Song Count by Album (TourStatsPostPage
        // shows it for either one via `needsAlbum`, and the two share one
        // selectedAlbum state — switching between these two stats keeps
        // whichever album was already picked). Same songsByAlbum source data,
        // just the reverse order.
        needsAlbum: true,
        isAvailable(tourData) {
            return (tourData.albumBreakdown?.length || 0) > 0;
        },
        compute(tourData, albumTitle, neverPlayedTitles) {
            if (!albumTitle) return { type: 'list', disabled: true, disabledReason: 'Pick an album above' };
            const songs = tourData.songsByAlbum?.[albumTitle];
            if (!songs?.length) return { type: 'list', disabled: true, disabledReason: 'No songs from this album were played on this tour' };
            const rarestFirst = [...songs].sort((a, b) => a.count - b.count || a.title.localeCompare(b.title));
            const { items, tiedNote } = buildRankedList(rarestFirst, s => `${s.count} show${s.count !== 1 ? 's' : ''}`);
            return {
                type: 'list',
                title: `Least Played from ${shortAlbumTitle(albumTitle)}`,
                items,
                tiedNote,
                // Documents the rest of the album's tracklist — songs that
                // got zero plays this tour never show up in songsByAlbum at
                // all (it's built only from setlist rows), so this is the
                // one place that gap gets called out rather than silently
                // disappearing.
                subdetail: neverPlayedTitles?.length > 0
                    ? `Never played this tour: ${neverPlayedTitles.join(', ')}`
                    : undefined,
            };
        },
    },
    {
        key: 'coversVsOriginals',
        label: 'Covers vs. Originals',
        compute(tourData) {
            const { songCounts, covers: nonAlbumCoverPlays } = tourData;
            if (!songCounts?.length) return { type: 'headline', disabled: true, disabledReason: 'No songs played yet' };
            // Direct title-level split, NOT the album-bucketed covers/otherOriginals
            // fields — those attribute a cover that's also an actual album track
            // (e.g. one of the covers on Mutiny After Midnight) to the album's
            // "original" bucket instead, which silently understates the real
            // cover percentage.
            let coverPlays = 0, originalPlays = 0;
            songCounts.forEach(s => {
                if (s.isOriginal === false) coverPlays += s.count;
                else originalPlays += s.count;
            });
            const total = coverPlays + originalPlays;
            if (total === 0) return { type: 'headline', disabled: true, disabledReason: 'No songs played yet' };
            const coverPct = Math.round((coverPlays / total) * 100);
            // A cover can also be an actual album track (same distinction
            // Album Breakdown's "Non-Album Covers" bucket makes) — without
            // calling that out here, this card's cover total won't match
            // that one's, and it'll look like the numbers disagree. covers
            // (non-album-only) is already available on tourData, so the
            // on-album count is just the remainder.
            const onAlbumCoverPlays = Math.max(0, coverPlays - (nonAlbumCoverPlays || 0));
            return {
                type: 'headline',
                headline: `${coverPct}%`,
                headlineSize: 'number',
                detail: 'of songs played were covers',
                subdetail: `${originalPlays} original plays · ${coverPlays} cover plays\n${onAlbumCoverPlays} of those are on an official album · ${nonAlbumCoverPlays || 0} aren't`,
            };
        },
    },
    {
        key: 'tourSnapshot',
        label: 'Tour Snapshot',
        // Renders with the tour map as its backdrop (see TourStatsPostPage/
        // TourStatGraphic's tourMapImageUrl handling) instead of the usual
        // panel layout — the raw numeric fields below (alongside the usual
        // headline/detail/subdetail, kept for the disabled-state fallback)
        // are what that map-centric layout actually displays, compact,
        // over the map rather than as one big centered number.
        compute(tourData) {
            const { playedShows, totalShows, songCounts, avgSongsPerShow, firstDate, lastDate } = tourData;
            if (!playedShows) return { type: 'headline', disabled: true, disabledReason: 'No shows played yet' };
            return {
                type: 'headline',
                headline: `${playedShows}/${totalShows}`,
                headlineSize: 'number',
                detail: 'shows played',
                subdetail: `${songCounts.length} unique songs · avg ${avgSongsPerShow.toFixed(1)}/show · ${formatDateShort(firstDate)} → ${formatDateShort(lastDate)}`,
                playedShows,
                totalShows,
                songCount: songCounts.length,
                avgSongsPerShow,
                firstDate,
                lastDate,
            };
        },
    },
];

export function getStatTypeByKey(key) {
    return TOUR_STAT_TYPES.find(s => s.key === key) || TOUR_STAT_TYPES[0];
}
