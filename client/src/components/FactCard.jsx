import { PText } from '@porsche-design-system/components-react';

// Shared small stat tile — used by ProfilePage's "By the Numbers" and
// UserStatsWidget's "My Stats", so the two stay visually in sync.
// `compact` trims padding/font size so more tiles fit per row (ProfilePage's
// 5-across "By the Numbers" row).
export default function FactCard({ label, value, sub, compact = false }) {
    return (
        <div className={compact ? "rounded-lg border border-white/10 bg-[#1a1e26] px-2.5 py-2 space-y-0.5 min-w-0" : "rounded-xl border border-white/10 bg-[#1a1e26] px-4 py-3 space-y-0.5"}>
            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }} ellipsis>{label}</PText>
            <div
                className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}
                style={{ color: 'var(--p-color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
                {value}
            </div>
            {sub && <PText size="xs" color="contrast-medium" ellipsis>{sub}</PText>}
        </div>
    );
}
