import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner } from '@porsche-design-system/components-react';
import { supabase } from '../services/supabase';
import { buildShowPath } from '../utils/showSlug';

function ShowCard({ show, variant }) {
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
                {variant === 'history' ? (
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

export default function OnThisDayWidget() {
    const [onThisDay, setOnThisDay] = useState([]);
    const [upcoming, setUpcoming] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;

            const [historyRes, upcomingRes] = await Promise.allSettled([
                supabase
                    .from('shows')
                    .select('id, show_date, artist_name, tour_name, venues(name, city, state_country)')
                    .lt('show_date', todayStr)
                    .like('show_date', `%-${mm}-${dd}`)
                    .order('show_date', { ascending: false }),
                supabase
                    .from('shows')
                    .select('id, show_date, artist_name, tour_name, venues(name, city, state_country)')
                    .gte('show_date', todayStr)
                    .order('show_date', { ascending: true })
                    .limit(3),
            ]);

            if (historyRes.status === 'fulfilled' && !historyRes.value.error) {
                setOnThisDay(historyRes.value.data || []);
            }
            if (upcomingRes.status === 'fulfilled' && !upcomingRes.value.error) {
                setUpcoming(upcomingRes.value.data || []);
            }
            setLoading(false);
        };

        fetchData();
    }, []);

    const today = new Date();
    const todayLabel = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <PSpinner size="medium" aria={{ 'aria-label': 'Loading' }} />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* On This Day */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5">
                <div className="flex items-baseline gap-2 mb-4">
                    <h3 className="font-display font-bold text-base" style={{ color: 'var(--p-color-primary)' }}>
                        On This Day in History
                    </h3>
                    <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {todayLabel}
                    </span>
                </div>

                {onThisDay.length === 0 ? (
                    <p className="text-sm py-6 text-center" style={{ color: 'var(--p-color-contrast-low)' }}>
                        No shows on {todayLabel} in past years
                    </p>
                ) : (
                    <div className="space-y-2">
                        {onThisDay.map(show => (
                            <ShowCard key={show.id} show={show} variant="history" />
                        ))}
                    </div>
                )}
            </div>

            {/* Upcoming Shows */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5">
                <div className="flex items-baseline gap-2 mb-4">
                    <h3 className="font-display font-bold text-base" style={{ color: 'var(--p-color-primary)' }}>
                        Upcoming Shows
                    </h3>
                </div>

                {upcoming.length === 0 ? (
                    <p className="text-sm py-6 text-center" style={{ color: 'var(--p-color-contrast-low)' }}>
                        No upcoming shows scheduled
                    </p>
                ) : (
                    <div className="space-y-2">
                        {upcoming.map(show => (
                            <ShowCard key={show.id} show={show} variant="upcoming" />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
