import { useState, useEffect } from 'react';
import { PSpinner, PText } from '@porsche-design-system/components-react';
import { getCommunityShowMap } from '../services/api';
import ShowMapShare from '../components/ShowMapShare';
import SEO from '../components/SEO';

export default function FanMapPage() {
    const [shows, setShows] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getCommunityShowMap()
            .then(data => { if (!cancelled) setShows(data.shows || []); })
            .catch(err => {
                console.error('[FanMapPage] Error loading community map:', err);
                if (!cancelled) setError('Failed to load the fan map.');
            });
        return () => { cancelled = true; };
    }, []);

    const totalAttendances = (shows || []).reduce((sum, s) => sum + (s.attendeeCount || 0), 0);

    return (
        <div className="px-4 py-4 md:py-6 max-w-6xl mx-auto">
            <SEO
                title="Fan Map"
                description="Every show a Skysets.org member has attended, mapped."
            />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Community Fan Map
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    {shows
                        ? `${shows.length} shows · ${totalAttendances} member check-ins, across every signed-up fan`
                        : 'Every show a Skysets.org member has attended'}
                </p>
            </div>

            {!shows && !error && (
                <div className="flex justify-center py-16">
                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading fan map' }} />
                </div>
            )}

            {error && (
                <PText color="notification-error" align="center" className="py-16">{error}</PText>
            )}

            {shows && shows.length === 0 && (
                <PText color="contrast-medium" align="center" className="py-16">
                    No attended shows have been logged yet.
                </PText>
            )}

            {shows && shows.length > 0 && (
                <ShowMapShare pastShows={shows} upcomingShows={[]} title="Community Fan Map" />
            )}
        </div>
    );
}
