import { useState, useEffect } from 'react';
import { PSpinner, PText } from '@porsche-design-system/components-react';
import { supabase } from '../services/supabase';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';
import ShowListCard from '../components/ShowListCard';

export default function UpcomingShowsPage() {
    const [upcoming, setUpcoming] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;

            const { data, error: fetchError } = await supabase
                .from('shows')
                .select('id, show_date, artist_name, tour_name, venues(name, city, state_country)')
                .gte('show_date', todayStr)
                .order('show_date', { ascending: true });

            if (cancelled) return;
            if (fetchError) {
                console.error('[UpcomingShowsPage] Error loading upcoming shows:', fetchError);
                setError('Failed to load upcoming shows');
            } else {
                setUpcoming(data || []);
            }
            setLoading(false);
        };

        fetchData();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-2xl mx-auto">
            <SEO
                title="Upcoming Shows"
                description="Every upcoming Sturgill Simpson and Johnny Blue Skies show, in chronological order."
            />

            <MainNavTabs />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Upcoming Shows
                </h1>
                {!loading && !error && (
                    <PText size="small" color="contrast-medium">
                        {upcoming.length} show{upcoming.length === 1 ? '' : 's'} scheduled
                    </PText>
                )}
            </div>

            {loading && (
                <div className="flex justify-center py-16">
                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading upcoming shows' }} />
                </div>
            )}

            {!loading && error && (
                <PText color="notification-error" align="center" className="py-16">{error}</PText>
            )}

            {!loading && !error && upcoming.length === 0 && (
                <PText color="contrast-medium" align="center" className="py-16">No upcoming shows scheduled.</PText>
            )}

            {!loading && !error && upcoming.length > 0 && (
                <div className="space-y-2">
                    {upcoming.map(show => (
                        <ShowListCard key={show.id} show={show} />
                    ))}
                </div>
            )}
        </div>
    );
}
