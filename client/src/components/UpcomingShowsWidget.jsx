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

            const { data, error } = await supabase
                .from('shows')
                .select('id, show_date, artist_name, tour_name, venues(name, city, state_country)')
                .gte('show_date', todayStr)
                .order('show_date', { ascending: true })
                .limit(3);

            if (!error) setUpcoming(data || []);
            setLoading(false);
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center py-10">
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
