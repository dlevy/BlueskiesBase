export const BADGES = [
    {
        id: 'cheap-seat',
        threshold: 1,
        emoji: '🎟️',
        name: 'Cheap Seat',
        song: 'The Cheapest Seats',
        desc: 'Welcome to the show',
    },
    {
        id: 'long-white-line',
        threshold: 5,
        emoji: '🛣️',
        name: 'Long White Line',
        song: 'Long White Line',
        desc: 'On the road',
    },
    {
        id: 'between-the-lines',
        threshold: 10,
        emoji: '🎸',
        name: 'Between the Lines',
        song: 'Keep It Between the Lines',
        desc: 'You know the groove',
    },
    {
        id: 'old-king-coal',
        threshold: 25,
        emoji: '⛏️',
        name: 'Old King Coal',
        song: 'Old King Coal',
        desc: 'A true devotee',
    },
    {
        id: 'turtles',
        threshold: 50,
        emoji: '🐢',
        name: 'Turtles All the Way Down',
        song: 'Turtles All the Way Down',
        desc: 'Deep in the rabbit hole',
    },
    {
        id: 'brace-for-impact',
        threshold: 75,
        emoji: '💥',
        name: 'Brace for Impact',
        song: 'Brace for Impact (Live a Little)',
        desc: 'Hardcore',
    },
    {
        id: 'crown',
        threshold: 100,
        emoji: '👑',
        name: 'You Can Have the Crown',
        song: 'You Can Have the Crown',
        desc: 'Legendary',
    },
];

export function getEarnedBadges(showCount) {
    return BADGES.filter(b => showCount >= b.threshold);
}

export function getHighestBadge(showCount) {
    const earned = getEarnedBadges(showCount);
    return earned[earned.length - 1] ?? null;
}

export function getNextBadge(showCount) {
    return BADGES.find(b => showCount < b.threshold) ?? null;
}
