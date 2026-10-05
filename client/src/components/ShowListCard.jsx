import { Link } from 'react-router-dom';
import { buildShowPath } from '../utils/showSlug';

// Shared show row — date badge + venue/tour info — used anywhere a flat,
// lightweight show list is needed (as opposed to ShowCard components
// elsewhere that include a setlist preview): the homepage's
// UpcomingShowsWidget, UpcomingShowsPage, and PastShowsPage all render the
// same row so they stay visually identical regardless of time direction.
export default function ShowListCard({ show }) {
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
                <span className="font-display font-bold text-xl leading-none text-amber-400">{dayNum}</span>
                <span className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>{monthStr}</span>
                <span className="text-[9px] mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>{y}</span>
            </div>

            {/* Show info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--p-color-primary)' }}>
                    {show.artist_name}
                </p>
                {show.venues && (
                    <>
                        <p className="text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            {show.venues.name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                            {show.venues.city}{show.venues.state_country ? `, ${show.venues.state_country}` : ''}
                        </p>
                    </>
                )}
                {show.tour_name && (
                    <p className="text-xs italic mt-0.5 truncate" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {show.tour_name}
                    </p>
                )}
            </div>

            <svg className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-30 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </Link>
    );
}
