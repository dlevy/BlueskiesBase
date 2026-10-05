import { useState, useEffect, useCallback } from 'react';
import { PButton, PSpinner, PText } from '@porsche-design-system/components-react';
import { getShows } from '../services/api';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';
import ShowListCard from '../components/ShowListCard';

// The full archive is in the hundreds of shows, unlike the handful of
// upcoming ones — "Load More" pagination via the existing paginated
// GET /api/shows (already sorted show_date desc) rather than fetching
// everything at once like UpcomingShowsPage can afford to.
const PAGE_SIZE = 25;

function todayStr() {
    const today = new Date();
    return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
}

export default function PastShowsPage() {
    const [shows, setShows] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);

    const loadPage = useCallback(async (pageNum) => {
        const data = await getShows(pageNum, PAGE_SIZE, { dateTo: todayStr() });
        setShows(prev => pageNum === 1 ? data.shows : [...prev, ...data.shows]);
        setPage(data.pagination.page);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
    }, []);

    useEffect(() => {
        let cancelled = false;
        loadPage(1)
            .catch(err => {
                if (cancelled) return;
                console.error('[PastShowsPage] Error loading shows:', err);
                setError('Failed to load shows');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [loadPage]);

    const handleLoadMore = async () => {
        setLoadingMore(true);
        try {
            await loadPage(page + 1);
        } catch (err) {
            console.error('[PastShowsPage] Error loading more shows:', err);
            setError('Failed to load more shows');
        } finally {
            setLoadingMore(false);
        }
    };

    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-2xl mx-auto">
            <SEO
                title="Past Shows"
                description="Every Sturgill Simpson and Johnny Blue Skies show in the archive, most recent first."
            />

            <MainNavTabs />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Past Shows
                </h1>
                {!loading && !error && (
                    <PText size="small" color="contrast-medium">
                        {total} show{total === 1 ? '' : 's'} in the archive
                    </PText>
                )}
            </div>

            {loading && (
                <div className="flex justify-center py-16">
                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading past shows' }} />
                </div>
            )}

            {!loading && error && (
                <PText color="notification-error" align="center" className="py-16">{error}</PText>
            )}

            {!loading && !error && shows.length === 0 && (
                <PText color="contrast-medium" align="center" className="py-16">No shows in the archive yet.</PText>
            )}

            {!loading && !error && shows.length > 0 && (
                <>
                    <div className="space-y-2">
                        {shows.map(show => (
                            <ShowListCard key={show.id} show={show} />
                        ))}
                    </div>

                    {page < totalPages && (
                        <div className="flex justify-center mt-4">
                            <PButton variant="secondary" loading={loadingMore} onClick={handleLoadMore}>
                                Load More
                            </PButton>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
