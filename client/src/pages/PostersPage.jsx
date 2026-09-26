import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner, PText } from '@porsche-design-system/components-react';
import { getAllPosters } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function PosterTile({ poster, onImageClick }) {
    const show = poster.shows;
    return (
        <div className="group rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-amber-500/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/30 transition-all duration-150">
            <button
                type="button"
                onClick={onImageClick}
                className="relative block w-full aspect-[2/3] overflow-hidden bg-white/5 cursor-pointer"
            >
                <img
                    src={poster.poster_url}
                    alt={poster.caption || `${show.artist_name} poster — ${show.venues?.name || show.venues?.city || ''}`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {poster.is_foil && (
                    <span
                        className="absolute top-1.5 right-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(192,132,252,0.85)', color: '#1a0b2e' }}
                    >
                        Foil
                    </span>
                )}
            </button>

            {/* Fixed-height row so tiles stay aligned whether or not a poster artist is credited */}
            <div className="px-3 pt-2 h-5 flex items-center justify-center text-center">
                {show.poster_artist_name ? (
                    <p className="text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Poster art by{' '}
                        {show.poster_artist_url ? (
                            <a href={show.poster_artist_url} target="_blank" rel="noopener noreferrer"
                                className="font-semibold text-amber-400 hover:underline">
                                {show.poster_artist_name}
                            </a>
                        ) : (
                            <span className="font-semibold" style={{ color: 'var(--p-color-primary)' }}>{show.poster_artist_name}</span>
                        )}
                    </p>
                ) : (
                    <span aria-hidden="true">&nbsp;</span>
                )}
            </div>

            <Link to={buildShowPath(show)} className="block p-3 pt-1 hover:bg-white/[0.05] transition-colors">
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
            </Link>
        </div>
    );
}

export default function PostersPage() {
    const [posters, setPosters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(-1);

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
                    {posters.map((poster, index) => (
                        <PosterTile key={poster.id} poster={poster} onImageClick={() => setLightboxIndex(index)} />
                    ))}
                </div>
            )}

            <Lightbox
                open={lightboxIndex >= 0}
                close={() => setLightboxIndex(-1)}
                index={lightboxIndex}
                slides={posters.map(p => ({ src: p.poster_url, alt: p.caption || 'Show poster', title: p.caption }))}
                on={{ view: ({ index }) => setLightboxIndex(index) }}
            />
        </div>
    );
}
