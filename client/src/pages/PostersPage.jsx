import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner, PText } from '@porsche-design-system/components-react';
import { getAllPosters } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function PosterTile({ poster }) {
    const show = poster.shows;
    return (
        <Link
            to={buildShowPath(show)}
            className="group block rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-amber-500/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/30 transition-all duration-150"
        >
            <div className="aspect-[2/3] overflow-hidden bg-white/5">
                <img
                    src={poster.poster_url}
                    alt={poster.caption || `${show.artist_name} poster — ${show.venues?.name || show.venues?.city || ''}`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
            </div>
            <div className="p-3">
                <p className="text-[10px] font-mono uppercase tracking-wide" style={{ color: 'var(--p-color-contrast-low)' }}>
                    {formatDate(show.show_date)}
                </p>
                <p className="text-sm font-semibold truncate mt-0.5" style={{ color: 'var(--p-color-primary)' }}>
                    {show.artist_name}
                </p>
                {show.venues && (
                    <p className="text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {show.venues.name}
                        <span style={{ color: 'var(--p-color-contrast-low)' }}>
                            {' — '}{show.venues.city}{show.venues.state_country ? `, ${show.venues.state_country}` : ''}
                        </span>
                    </p>
                )}
            </div>
        </Link>
    );
}

export default function PostersPage() {
    const [posters, setPosters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        getAllPosters()
            .then(data => {
                if (cancelled) return;
                setPosters(data.posters || []);
            })
            .catch(err => {
                console.error('[PostersPage] Error loading posters:', err);
                if (!cancelled) setError('Failed to load posters');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    return (
        <div className="px-4 py-4 md:py-6 max-w-6xl mx-auto">
            <SEO
                title="Posters"
                description="Show posters from the Sturgill Simpson and Johnny Blue Skies setlist archive, newest first."
            />

            <MainNavTabs />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Posters
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    {posters.length > 0 ? `${posters.length} show poster${posters.length !== 1 ? 's' : ''}, newest first` : 'Show posters from the archive'}
                </p>
            </div>

            {loading && (
                <div className="flex justify-center py-16">
                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading posters' }} />
                </div>
            )}

            {!loading && error && (
                <PText color="notification-error" align="center" className="py-16">{error}</PText>
            )}

            {!loading && !error && posters.length === 0 && (
                <PText color="contrast-medium" align="center" className="py-16">
                    No posters uploaded yet.
                </PText>
            )}

            {!loading && !error && posters.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {posters.map(poster => (
                        <PosterTile key={poster.id} poster={poster} />
                    ))}
                </div>
            )}
        </div>
    );
}
