import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner } from '@porsche-design-system/components-react';
import { supabase } from '../services/supabase';
import ShowListCard from './ShowListCard';

export default function UpcomingShowsWidget({ onReady }) {
    const [upcoming, setUpcoming] = useState([]);
    const [onThisDay, setOnThisDay] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const todayStr = `${yyyy}-${mm}-${dd}`;

                // Strictly after today — a same-day show is always the one
                // NextShowWidget features as "Tonight's Show" at the top of the
                // homepage, so it's excluded here to avoid showing it twice. A
                // future show NextShowWidget features as "Next Show" stays in
                // this list too — it's only highlighted up top, not pulled out.
                // A canceled show isn't really "coming up" — excluded from this
                // teaser list the same way it's excluded from NextShowWidget, rather
                // than shown with a badge here (the full /upcoming-shows page is
                // where a canceled show stays visible for the record).
                const { data, error } = await supabase
                    .from('shows')
                    .select('id, show_date, artist_name, tour_name, is_cancelled, venues(name, city, state_country)')
                    .gt('show_date', todayStr)
                    .order('show_date', { ascending: true })
                    .order('day_order', { ascending: true })
                    .limit(10);

                const upcomingShows = error ? [] : (data || []).filter(s => !s.is_cancelled).slice(0, 3);
                setUpcoming(upcomingShows);

                // No upcoming shows to tease — fall back to "On This Day in
                // History" so the slot isn't just an empty-state message.
                // Only fetched when actually needed, since most of the time
                // there IS something upcoming and this query would go unused.
                if (upcomingShows.length === 0) {
                    // Explicit date strings for this month/day across past years —
                    // .like() on a date column fails in PostgreSQL without an
                    // explicit text cast, so .in() is used instead.
                    const pastDates = [];
                    for (let year = 2010; year < yyyy; year++) {
                        pastDates.push(`${year}-${mm}-${dd}`);
                    }
                    const { data: historyData, error: historyError } = await supabase
                        .from('shows')
                        .select('id, show_date, artist_name, tour_name, venues(name, city, state_country)')
                        .in('show_date', pastDates)
                        .order('show_date', { ascending: false });
                    if (!historyError) setOnThisDay(historyData || []);
                }
            } catch (err) {
                console.error('[UpcomingShowsWidget] Error fetching upcoming shows:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => { if (!loading) onReady?.(); }, [loading]);

    if (loading) {
        // min-h approximates the loaded card's typical height (header + up to
        // 3 show rows) — without it, this collapses to a bare spinner and the
        // page jumps once real content lands, pushing the footer down with it.
        // That jump, paired with TourStatsWidget's identical issue right next
        // to it in the same grid, was the dominant contributor to a reported
        // 0.391 CLS score.
        return (
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 min-h-[320px] flex items-center justify-center">
                <PSpinner size="medium" aria={{ 'aria-label': 'Loading' }} />
            </div>
        );
    }

    if (upcoming.length === 0) {
        const todayLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        return (
            <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-4">
                    <p className="text-sm text-center" style={{ color: 'var(--p-color-contrast-low)' }}>
                        No upcoming shows scheduled
                    </p>
                </div>

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
                        // Fixed height so a day with many past shows scrolls in place
                        // instead of growing the card — matches the ~3-row height the
                        // "Upcoming Shows" layout this replaces would have had.
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {onThisDay.map(show => (
                                <ShowListCard key={show.id} show={show} yearOnly />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5">
            <div className="flex items-baseline justify-between gap-2 mb-4">
                <h3 className="font-display font-bold text-base" style={{ color: 'var(--p-color-primary)' }}>
                    Upcoming Shows
                </h3>
                <Link
                    to="/upcoming-shows"
                    className="text-xs font-medium shrink-0 hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--p-color-info)' }}
                >
                    View All →
                </Link>
            </div>

            <div className="space-y-2">
                {upcoming.map(show => (
                    <ShowListCard key={show.id} show={show} />
                ))}
            </div>
        </div>
    );
}
