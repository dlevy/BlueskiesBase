import {
    BADGES, getHighestBadge, getNextBadge,
    COMMUNITY_TIERS, getHighestCommunityTier, getNextCommunityTier,
} from '../utils/badges';

function TierRow({ title, tiers, count, highest, next, unit }) {
    const earnedSet = new Set(tiers.filter(t => count >= t.threshold).map(t => t.id));
    const progressPct = next ? Math.min(100, Math.round((count / next.threshold) * 100)) : 100;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="font-display font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--p-color-contrast-low)' }}>
                    {title}
                </h4>
                <span className="text-xs font-medium" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    {count} {unit}
                </span>
            </div>

            <div className="flex flex-wrap gap-3">
                {tiers.map((tier) => {
                    const isEarned = earnedSet.has(tier.id);
                    const isHighest = highest?.id === tier.id;
                    return (
                        <div
                            key={tier.id}
                            title={tier.desc}
                            className="flex flex-col items-center gap-1.5 w-20 group cursor-default"
                        >
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-200 relative"
                                style={{
                                    background: isEarned
                                        ? isHighest
                                            ? 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.12))'
                                            : 'rgba(245,158,11,0.1)'
                                        : 'rgba(255,255,255,0.04)',
                                    border: isHighest
                                        ? '2px solid rgba(245,158,11,0.55)'
                                        : isEarned
                                        ? '1.5px solid rgba(245,158,11,0.25)'
                                        : '1.5px solid rgba(255,255,255,0.06)',
                                    opacity: isEarned ? 1 : 0.35,
                                    boxShadow: isHighest ? '0 0 18px rgba(245,158,11,0.22)' : 'none',
                                }}
                            >
                                {tier.emoji}
                                {isHighest && (
                                    <span
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                                        style={{ background: '#f59e0b', fontSize: 9 }}
                                    >
                                        ★
                                    </span>
                                )}
                            </div>
                            <span
                                className="text-center leading-tight"
                                style={{
                                    fontSize: 10,
                                    lineHeight: '1.25',
                                    color: isEarned ? 'var(--p-color-contrast-medium)' : 'var(--p-color-contrast-low)',
                                    opacity: isEarned ? 1 : 0.55,
                                }}
                            >
                                {tier.name}
                            </span>
                        </div>
                    );
                })}
            </div>

            {highest && next && (
                <div className="space-y-1">
                    <div className="flex justify-between text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        <span>{highest.emoji} {highest.name}</span>
                        <span>{next.threshold - count} more to unlock {next.emoji} {next.name}</span>
                    </div>
                    <div className="rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #b45309, #f59e0b)' }}
                        />
                    </div>
                </div>
            )}

            {highest && !next && (
                <p className="text-xs" style={{ color: '#f59e0b' }}>
                    {highest.emoji} {highest.name} — maximum tier reached!
                </p>
            )}

            {!highest && (
                <p className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                    {tiers[0].desc} to unlock your first {title.toLowerCase()} achievement.
                </p>
            )}
        </div>
    );
}

export default function AchievementsPanel({ showCount, contributionCount = 0 }) {
    const highestAttendance = getHighestBadge(showCount);
    const nextAttendance = getNextBadge(showCount);
    const highestCommunity = getHighestCommunityTier(contributionCount);
    const nextCommunity = getNextCommunityTier(contributionCount);

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
            <div>
                <h3 className="font-display font-bold text-lg">Achievements</h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    Earn achievements by attending shows and contributing to the archive.
                </p>
            </div>

            <TierRow
                title="Attendance"
                tiers={BADGES}
                count={showCount}
                highest={highestAttendance}
                next={nextAttendance}
                unit={showCount === 1 ? 'show' : 'shows'}
            />

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

            <TierRow
                title="Community"
                tiers={COMMUNITY_TIERS}
                count={contributionCount}
                highest={highestCommunity}
                next={nextCommunity}
                unit={contributionCount === 1 ? 'contribution' : 'contributions'}
            />
        </div>
    );
}
