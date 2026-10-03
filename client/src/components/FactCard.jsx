import { PText } from '@porsche-design-system/components-react';

// Shared small stat tile — used by ProfilePage's "By the Numbers" and
// UserStatsWidget's "My Stats", so the two stay visually in sync.
export default function FactCard({ label, value, sub }) {
    return (
        <div className="rounded-xl border border-white/10 bg-[#1a1e26] px-4 py-3 space-y-0.5">
            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</PText>
            <div className="text-sm font-semibold" style={{ color: 'var(--p-color-primary)' }}>{value}</div>
            {sub && <PText size="xs" color="contrast-medium">{sub}</PText>}
        </div>
    );
}
