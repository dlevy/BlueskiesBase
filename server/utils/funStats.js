const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/**
 * Derived "fun stats" from a user's past attended shows + songs seen — favorite
 * venue/city, first show, busiest year, etc. Ported from the client-only
 * computeFunStats() in client/src/pages/StatsPage.jsx so the public profile route
 * (which can't rely on the viewer's own auth token to compute another user's stats)
 * can compute the same thing server-side. Kept in lockstep with that client version;
 * StatsPage.jsx itself is left untouched.
 */
function computeFunStats(pastShows, songsSeen) {
    if (!pastShows.length) return null;
    const sorted = [...pastShows].sort((a, b) => a.show_date.localeCompare(b.show_date));

    const cityCounts  = {};
    const venueCounts = {};
    const monthCounts = {};
    const dowCounts   = {};
    const yearCounts  = {};
    const cities   = new Set();
    const regions  = new Set();

    for (const show of pastShows) {
        const [y, m, d] = show.show_date.split('-');
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        const city      = show.venues?.city  || 'Unknown';
        const venueName = show.venues?.name  || 'Unknown';
        const venueKey  = `${venueName}||${city}`;
        const month = MONTHS[date.getMonth()];
        const dow   = DAYS[date.getDay()];

        cityCounts[city] = (cityCounts[city] || 0) + 1;
        if (!venueCounts[venueKey]) venueCounts[venueKey] = { name: venueName, city, count: 0 };
        venueCounts[venueKey].count++;
        monthCounts[month] = (monthCounts[month] || 0) + 1;
        dowCounts[dow]     = (dowCounts[dow]     || 0) + 1;
        yearCounts[y]      = (yearCounts[y]       || 0) + 1;
        cities.add(city);
        if (show.venues?.state_country) regions.add(show.venues.state_country);
    }

    const topCity  = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0];
    const topVenue = Object.values(venueCounts).sort((a, b) => b.count - a.count)[0];
    const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
    const topDow   = Object.entries(dowCounts).sort((a, b)   => b[1] - a[1])[0];
    const topSong  = songsSeen?.length
        ? [...songsSeen].sort((a, b) => b.playCount - a.playCount)[0]
        : null;

    const yearRows = Object.entries(yearCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, count]) => ({ year, count }));
    const maxYearCount = Math.max(...yearRows.map(r => r.count));
    const topYear = yearRows.length
        ? yearRows.reduce((max, r) => (r.count > max.count ? r : max))
        : null;

    return {
        firstShow: sorted[0],
        topCity:   topCity  ? { name: topCity[0],  count: topCity[1]  } : null,
        topVenue,
        topMonth:  topMonth ? { name: topMonth[0], count: topMonth[1] } : null,
        topDow:    topDow   ? { name: topDow[0],   count: topDow[1]   } : null,
        topSong,
        topYear,
        uniqueCities:  cities.size,
        uniqueRegions: regions.size,
        yearRows,
        maxYearCount,
    };
}

module.exports = { computeFunStats };
