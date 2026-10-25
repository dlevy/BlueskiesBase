import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner } from '@porsche-design-system/components-react';
import { supabase } from '../services/supabase';
import ShowListCard from './ShowListCard';

export default function UpcomingShowsWidget() {
    const [upcoming, setUpcoming] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
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
            const { data, error } = await supabase
                .from('shows')
                .select('id, show_date, artist_name, tour_name, venues(name, city, state_country)')
                .gt('show_date', todayStr)
                .order('show_date', { ascending: true })
                .order('day_order', { ascending: true })
                .limit(3);

            if (!error) setUpcoming(data || []);
            setLoading(false);
        };

        fetchData();
    }, []);

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

            {upcoming.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--p-color-contrast-low)' }}>
                    No upcoming shows scheduled
                </p>
            ) : (
                <div className="space-y-2">
                    {upcoming.map(show => (
                        <ShowListCard key={show.id} show={show} />
                    ))}
                </div>
            )}
        </div>
    );
}
