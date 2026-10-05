import { useState, useEffect, useCallback } from 'react';
import { PHeading, PText, PSpinner, PInlineNotification } from '@porsche-design-system/components-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getAnalyticsSummary } from '../../services/api';

const RANGE_OPTIONS = [
    { label: '7 days', days: 7 },
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
];

function isoDateDaysAgo(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function formatShortDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RankedList({ title, rows, emptyText, formatLabel }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5">
            <h3 className="font-display font-bold text-sm mb-3" style={{ color: 'var(--p-color-primary)' }}>{title}</h3>
            {rows.length === 0 ? (
                <PText size="small" color="contrast-medium">{emptyText}</PText>
            ) : (
                <ol className="space-y-1.5">
                    {rows.map((row, i) => (
                        <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                <span className="inline-block w-5 shrink-0" style={{ color: 'var(--p-color-contrast-low)' }}>{i + 1}.</span>
                                {formatLabel ? formatLabel(row.key) : row.key}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums" style={{ color: 'var(--p-color-primary)' }}>{row.count}</span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

export default function AnalyticsPage() {
    const [rangeDays, setRangeDays] = useState(30);
    const [includeStaff, setIncludeStaff] = useState(false);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getAnalyticsSummary({ from: isoDateDaysAgo(rangeDays), to: todayStr(), includeStaff });
            setSummary(data);
        } catch (err) {
            console.error('[AnalyticsPage] Error loading analytics:', err);
            setError(err.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [rangeDays, includeStaff]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <PHeading size="2xl" tag="h1">Analytics</PHeading>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex gap-1.5">
                        {RANGE_OPTIONS.map(opt => (
                            <button
                                key={opt.days}
                                type="button"
                                onClick={() => setRangeDays(opt.days)}
                                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                                    rangeDays === opt.days
                                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                        : 'border-white/10 hover:border-white/25'
                                }`}
                                style={rangeDays !== opt.days ? { color: 'var(--p-color-contrast-medium)' } : undefined}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        <input type="checkbox" checked={includeStaff} onChange={e => setIncludeStaff(e.target.checked)} />
                        Include staff views
                    </label>
                </div>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            {loading && (
                <div className="flex justify-center py-16">
                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading analytics' }} />
                </div>
            )}

            {!loading && !error && summary && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 text-center">
                            <div className="font-display font-bold text-3xl text-amber-400">{summary.totalPageviews}</div>
                            <PText size="xs" color="contrast-medium">Page Views</PText>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 text-center">
                            <div className="font-display font-bold text-3xl text-amber-400">{summary.uniqueSessions}</div>
                            <PText size="xs" color="contrast-medium">Unique Sessions</PText>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5">
                        <h3 className="font-display font-bold text-sm mb-3" style={{ color: 'var(--p-color-primary)' }}>Page Views Over Time</h3>
                        {summary.dailyPageviews.length === 0 ? (
                            <PText size="small" color="contrast-medium">No page views in this range yet.</PText>
                        ) : (
                            <div style={{ width: '100%', height: 220 }}>
                                <ResponsiveContainer>
                                    <BarChart data={summary.dailyPageviews}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={formatShortDate}
                                            tick={{ fill: 'var(--p-color-contrast-low)', fontSize: 11 }}
                                            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            tick={{ fill: 'var(--p-color-contrast-low)', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={32}
                                        />
                                        <Tooltip
                                            labelFormatter={formatShortDate}
                                            contentStyle={{ background: '#0f1218', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                                            labelStyle={{ color: 'var(--p-color-primary)' }}
                                        />
                                        <Bar dataKey="count" name="Page Views" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <RankedList title="Most Viewed Pages" rows={summary.topPages} emptyText="No page views yet." />
                        <RankedList title="Least Viewed Pages" rows={summary.leastViewedPages} emptyText="No page views yet." />
                    </div>

                    <RankedList
                        title="Feature Usage"
                        rows={summary.topFeatures}
                        emptyText="No feature events logged yet."
                    />
                </>
            )}
        </div>
    );
}
