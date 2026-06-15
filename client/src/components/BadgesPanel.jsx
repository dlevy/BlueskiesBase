import { BADGES, getEarnedBadges, getHighestBadge, getNextBadge } from '../utils/badges';

export default function BadgesPanel({ showCount }) {
    const earned = getEarnedBadges(showCount);
    const highest = getHighestBadge(showCount);
    const next = getNextBadge(showCount);
    const earnedSet = new Set(earned.map(b => b.id));

    const progressPct = next
        ? Math.min(100, Math.round((showCount / next.threshold) * 100))
        : 100;

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--p-color-contrast-low)' }}>
                    My Badges
                </h3>
                {highest && (
                    <span className="text-xs font-medium" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {earned.length}/{BADGES.length} unlocked
                    </span>
                )}
            </div>

            {/* Badge row */}
            <div className="flex flex-wrap gap-2">
                {BADGES.map((badge) => {
                    const isEarned = earnedSet.has(badge.id);
                    const isHighest = highest?.id === badge.id;
                    return (
                        <div
                            key={badge.id}
                            title={`${badge.name} · "${badge.song}" · ${badge.threshold}+ shows`}
                            className="flex flex-col items-center gap-1 w-16 group cursor-default"
                        >
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all duration-200 relative"
                                style={{
                                    background: isEarned
                                        ? isHighest
                                            ? 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.12))'
                                            : 'rgba(245,158,11,0.1)'
                                        : 'rgba(255,255,255,0.04)',
                                    border: isHighest
                                        ? '1.5px solid rgba(245,158,11,0.55)'
                                        : isEarned
                                        ? '1.5px solid rgba(245,158,11,0.25)'
                                        : '1.5px solid rgba(255,255,255,0.06)',
                                    opacity: isEarned ? 1 : 0.35,
                                    boxShadow: isHighest ? '0 0 16px rgba(245,158,11,0.2)' : 'none',
                                }}
                            >
                                {badge.emoji}
                                {isHighest && (
                                    <span
                                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                                        style={{ background: '#f59e0b', fontSize: 8 }}
                                    >
                                        ★
                                    </span>
                                )}
                            </div>
                            <span
                                className="text-center leading-tight"
                                style={{
                                    fontSize: 9,
                                    lineHeight: '1.2',
                                    color: isEarned ? 'var(--p-color-contrast-medium)' : 'var(--p-color-contrast-low)',
                                    opacity: isEarned ? 1 : 0.5,
                                }}
                            >
                                {badge.threshold}+
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Highest badge callout + progress */}
            {highest && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-base">{highest.emoji}</span>
                        <div>
                            <p className="text-sm font-semibold leading-tight" style={{ color: '#f59e0b' }}>
                                {highest.name}
                            </p>
                            <p className="text-xs leading-tight" style={{ color: 'var(--p-color-contrast-low)' }}>
                                "{highest.song}"
                            </p>
                        </div>
                    </div>

                    {next && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                <span>{showCount} shows</span>
                                <span>{next.threshold - showCount} more to unlock {next.emoji} {next.name}</span>
                            </div>
                            <div className="rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                        width: `${progressPct}%`,
                                        background: 'linear-gradient(90deg, #b45309, #f59e0b)',
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {!next && (
                        <p className="text-xs" style={{ color: '#f59e0b' }}>
                            Maximum tier reached — legendary status! 👑
                        </p>
                    )}
                </div>
            )}

            {!highest && (
                <p className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                    Attend your first show to unlock your first badge!
                </p>
            )}
        </div>
    );
}
