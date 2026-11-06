import { Link } from 'react-router-dom';
import { buildShowPath } from '../utils/showSlug';
import { formatVenueLocation } from '../utils/geography';

// Shared show row — date badge + venue/tour info — used anywhere a flat,
// lightweight show list is needed (as opposed to ShowCard components
// elsewhere that include a setlist preview): the homepage's
// UpcomingShowsWidget, UpcomingShowsPage, and PastShowsPage all render the
// same row so they stay visually identical regardless of time direction.
// yearOnly swaps the date badge to just the year — used by the "On This
// Day in History" list, where every row already shares the same month/day,
// so the day/month would be redundant and the year is what distinguishes them.
// hideCountry drops the country from the location line (city + state only) —
// opt-in per caller rather than the default, so PastShowsPage/TourPage keep
// showing the full location unless a caller asks otherwise.
// inlineVenueName puts the venue name on the same line as the location
// ("Venue — City, State") instead of its own line above it, matching the
// one-line style used elsewhere (e.g. MostRecentShowWidget's ShowCard).
export default function ShowListCard({ show, yearOnly = false, hideCountry = false, inlineVenueName = false }) {
    const [y, m, d] = show.show_date.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const monthStr = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
    const dayNum = parseInt(d, 10);

    return (
        <Link
            to={buildShowPath(show)}
            className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.03] hover:border-amber-500/20 hover:bg-white/[0.06] transition-all duration-150 group"
        >
            {/* Date column */}
            <div className="shrink-0 w-12 flex flex-col items-center text-center">
                {yearOnly ? (
                    <span className="font-display font-bold text-lg leading-none text-amber-400">{y}</span>
                ) : (
                    <>
                        <span className="font-display font-bold text-xl leading-none text-amber-400">{dayNum}</span>
                        <span className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>{monthStr}</span>
                        <span className="text-[9px] mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>{y}</span>
                    </>
                )}
            </div>

            {/* Show info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--p-color-primary)' }}>
                    {show.artist_name}
                    {show.is_cancelled && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                            Canceled
                        </span>
                    )}
                </p>
                {show.venues && (
                    inlineVenueName ? (
                        <p className="text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            {show.venues.name}
                            <span style={{ color: 'var(--p-color-contrast-low)' }}>
                                {' — '}{hideCountry
                                    ? [show.venues.city, show.venues.state].filter(Boolean).join(', ')
                                    : formatVenueLocation(show.venues)}
                            </span>
                        </p>
                    ) : (
                        <>
                            <p className="text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                {show.venues.name}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                {hideCountry
                                    ? [show.venues.city, show.venues.state].filter(Boolean).join(', ')
                                    : formatVenueLocation(show.venues)}
                            </p>
                        </>
                    )
                )}
                {show.tour_name && (
                    <p className="text-xs italic mt-0.5 truncate" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {show.tour_name}
                    </p>
                )}
            </div>

            <svg aria-hidden="true" className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-30 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </Link>
    );
}
