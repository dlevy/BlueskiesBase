// Duplicated across client/src/utils/showSlug.js, tourSlug.js, etc. — keep in sync.
export function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// A category with id: null (the synthetic "Other" bucket for threads whose
// real category was deleted — see GET /api/forum/categories) always resolves
// to the fixed slug 'other' rather than slugify('Other'), so it can't
// collide with a real category someone names "Other".
export function buildCategoryPath(category) {
    return `/forum/${category?.id ? slugify(category.name) : 'other'}`;
}

export function buildThreadPath(threadId) {
    return `/forum/thread/${threadId}`;
}

// Resolves a :categorySlug URL param against a loaded category list — same
// shape as TourPage's resolution against fetchTourList(). Returns the
// matching category (id: null for 'other'), or null if zero/more-than-one
// real categories match (a name collision, same not-found posture as every
// other slug resolution in this codebase).
export function resolveCategoryBySlug(categories, slug) {
    if (slug === 'other') return { id: null, name: 'Other' };
    const matches = categories.filter(c => c.id && slugify(c.name) === slug);
    if (matches.length !== 1) return null;
    return matches[0];
}
