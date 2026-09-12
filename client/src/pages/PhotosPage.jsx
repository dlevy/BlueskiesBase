import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner, PText } from '@porsche-design-system/components-react';
import { getAllPhotos } from '../services/api';
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

// Unlike posters (one per show), a show commonly has several photos — grouped into one
// section per show rather than flattened to one gallery tile per photo, so the same show
// doesn't repeat itself over and over in a row.
function ShowPhotoSection({ show, photos, onPhotoClick }) {
    const showPath = buildShowPath(show);
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <Link to={showPath} className="block px-4 py-3 hover:bg-white/[0.05] transition-colors group">
                <p className="text-[10px] font-mono uppercase tracking-wide" style={{ color: 'var(--p-color-contrast-low)' }}>
                    {formatDate(show.show_date)}
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--p-color-primary)' }}>
                    {show.artist_name}
                </p>
                {show.venues && (
                    <p className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {show.venues.name}
                        <span style={{ color: 'var(--p-color-contrast-low)' }}>
                            {' — '}{show.venues.city}{show.venues.state_country ? `, ${show.venues.state_country}` : ''}
                        </span>
                    </p>
                )}
            </Link>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1 p-1">
                {photos.map(photo => (
                    <button
                        key={photo.id}
                        type="button"
                        onClick={() => onPhotoClick(photo)}
                        className="block aspect-square overflow-hidden rounded-md bg-white/5 group cursor-pointer"
                    >
                        <img
                            src={photo.photo_url}
                            alt={photo.caption || `${show.artist_name} — ${show.venues?.city || ''}`}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 group-hover:opacity-90 transition-all duration-300"
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function PhotosPage() {
    const [groups, setGroups] = useState([]);
    const [allPhotos, setAllPhotos] = useState([]);
    const [totalPhotos, setTotalPhotos] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(-1);

    useEffect(() => {
        let cancelled = false;

        getAllPhotos()
            .then(data => {
                if (cancelled) return;
                const photos = data.photos || [];
                setTotalPhotos(photos.length);
                setAllPhotos(photos);

                // Server already returns newest-show-first with each show's own photos
                // in display_order — group by show, preserving that order.
                const byShowId = new Map();
                photos.forEach(photo => {
                    const show = photo.shows;
                    if (!byShowId.has(show.id)) byShowId.set(show.id, { show, photos: [] });
                    byShowId.get(show.id).photos.push(photo);
                });
                setGroups([...byShowId.values()]);
            })
            .catch(err => {
                console.error('[PhotosPage] Error loading photos:', err);
                if (!cancelled) setError('Failed to load photos');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    return (
        <div className="px-4 py-4 md:py-6 max-w-6xl mx-auto">
            <SEO
                title="Photos"
                description="Fan photos from the Sturgill Simpson and Johnny Blue Skies setlist archive, newest show first."
            />

            <MainNavTabs />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Photos
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    {totalPhotos > 0
                        ? `${totalPhotos} photo${totalPhotos !== 1 ? 's' : ''} across ${groups.length} show${groups.length !== 1 ? 's' : ''}, newest first`
                        : 'Fan photos from the archive'}
                </p>
            </div>

            {loading && (
                <div className="flex justify-center py-16">
                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading photos' }} />
                </div>
            )}

            {!loading && error && (
                <PText color="notification-error" align="center" className="py-16">{error}</PText>
            )}

            {!loading && !error && groups.length === 0 && (
                <PText color="contrast-medium" align="center" className="py-16">
                    No photos uploaded yet.
                </PText>
            )}

            {!loading && !error && groups.length > 0 && (
                <div className="space-y-4">
                    {groups.map(({ show, photos }) => (
                        <ShowPhotoSection
                            key={show.id}
                            show={show}
                            photos={photos}
                            onPhotoClick={(photo) => setLightboxIndex(allPhotos.findIndex(p => p.id === photo.id))}
                        />
                    ))}
                </div>
            )}

            <Lightbox
                open={lightboxIndex >= 0}
                close={() => setLightboxIndex(-1)}
                index={lightboxIndex}
                slides={allPhotos.map(p => ({ src: p.photo_url, alt: p.caption || 'Show photo', title: p.caption }))}
                on={{ view: ({ index }) => setLightboxIndex(index) }}
            />
        </div>
    );
}
