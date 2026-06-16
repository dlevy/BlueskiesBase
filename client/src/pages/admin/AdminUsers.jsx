import { useState, useEffect } from 'react';
import { PHeading, PText, PSpinner, PInlineNotification } from '@porsche-design-system/components-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function buildWeeklyChart(users) {
    if (!users.length) return [];
    // Group by ISO week start (Monday)
    const weekMap = new Map();
    users.forEach(u => {
        const d = new Date(u.created_at);
        // Get Monday of that week
        const day = d.getDay(); // 0=Sun
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        const key = monday.toISOString().split('T')[0];
        weekMap.set(key, (weekMap.get(key) || 0) + 1);
    });
    return [...weekMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({
            week: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            count,
        }));
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg px-3 py-2" style={{ background: '#1a1e26', border: '1px solid rgba(255,255,255,0.12)' }}>
            <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>Week of {label}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{payload[0].value} signup{payload[0].value !== 1 ? 's' : ''}</p>
        </div>
    );
};

const FILTERS = [
    { id: 'all',               label: 'All users' },
    { id: 'confirmed-no-signin', label: 'Confirmed, never signed in' },
    { id: 'unconfirmed',       label: 'Never confirmed' },
    { id: 'inactive',          label: 'Inactive >' },
];

function applyFilter(users, filterMode, inactiveDays) {
    const now = Date.now();
    switch (filterMode) {
        case 'confirmed-no-signin':
            return users.filter(u => u.confirmed && !u.last_sign_in_at);
        case 'unconfirmed':
            return users.filter(u => !u.confirmed);
        case 'inactive': {
            const cutoff = now - inactiveDays * 86_400_000;
            return users.filter(u => {
                if (u.last_sign_in_at) return new Date(u.last_sign_in_at).getTime() < cutoff;
                // Never signed in — count from signup date
                return new Date(u.created_at).getTime() < cutoff;
            });
        }
        default:
            return users;
    }
}

function exportCsv(rows, filterLabel) {
    const headers = ['Email', 'Signed Up', 'Last Sign In', 'Status'];
    const fmt = str => str ? new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';
    const lines = [
        headers.join(','),
        ...rows.map(u => [
            `"${u.email}"`,
            `"${fmt(u.created_at)}"`,
            `"${fmt(u.last_sign_in_at)}"`,
            u.confirmed ? 'Confirmed' : 'Unconfirmed',
        ].join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `skysets-users-${filterLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function AdminUsers() {
    const { getToken } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [resending, setResending] = useState(null);
    const [resendStatus, setResendStatus] = useState({});
    const [search, setSearch] = useState('');
    const [filterMode, setFilterMode] = useState('all');
    const [inactiveDays, setInactiveDays] = useState(90);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setUsers(data.users || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const resendConfirmation = async (userId, email) => {
        setResending(userId);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/api/admin/users/${userId}/resend-confirmation`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setResendStatus(s => ({ ...s, [userId]: 'sent' }));
        } catch (err) {
            setResendStatus(s => ({ ...s, [userId]: 'error' }));
        } finally {
            setResending(null);
        }
    };

    const filterApplied = applyFilter(users, filterMode, inactiveDays);
    const filtered = filterApplied.filter(u =>
        !search || u.email.toLowerCase().includes(search.toLowerCase())
    );

    const confirmed   = users.filter(u => u.confirmed).length;
    const unconfirmed = users.length - confirmed;
    // Chart always uses the full user list — unaffected by filters
    const weeklyData = buildWeeklyChart(users);

    const activeFilterLabel = filterMode === 'inactive'
        ? `Inactive >${inactiveDays}d`
        : (FILTERS.find(f => f.id === filterMode)?.label ?? 'All users');

    const formatDate = (str) => {
        if (!str) return '—';
        return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center gap-4 py-16">
                <PSpinner size="large" aria={{ 'aria-label': 'Loading users' }} />
                <PText color="contrast-medium">Loading users…</PText>
            </div>
        );
    }

    if (error) {
        return (
            <PInlineNotification
                heading="Failed to load users"
                description={error}
                state="error"
                dismissButton={false}
            />
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <PHeading size="2xl" tag="h1">Users</PHeading>
                <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                        {users.length} total
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                        {confirmed} confirmed
                    </span>
                    {unconfirmed > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                            {unconfirmed} unconfirmed
                        </span>
                    )}
                </div>
            </div>

            {/* Signups by week chart */}
            {weeklyData.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
                    <PHeading size="md" tag="h2">Signups by Week</PHeading>
                    <div style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                                <XAxis
                                    dataKey="week"
                                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {weeklyData.map((_, i) => (
                                        <Cell key={i} fill="#f59e0b" fillOpacity={0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* User table */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] overflow-hidden">
                {/* Filter pills */}
                <div className="px-4 pt-4 pb-3 border-b border-white/10 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {FILTERS.map(f => {
                            const active = filterMode === f.id;
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => setFilterMode(f.id)}
                                    className="text-xs px-3 py-1.5 rounded-full border transition-all"
                                    style={active
                                        ? { background: 'rgba(245,158,11,0.18)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.45)' }
                                        : { background: 'transparent', color: 'rgba(255,255,255,0.45)', borderColor: 'rgba(255,255,255,0.12)' }
                                    }
                                >
                                    {f.label}
                                    {f.id === 'inactive' && filterMode === 'inactive' && (
                                        <input
                                            type="number"
                                            min={1}
                                            max={3650}
                                            value={inactiveDays}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setInactiveDays(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="ml-1.5 w-12 rounded bg-black/30 border border-white/20 text-center text-xs outline-none px-1"
                                            style={{ color: '#f59e0b' }}
                                        />
                                    )}
                                    {f.id === 'inactive' && filterMode === 'inactive' && (
                                        <span className="ml-0.5">days</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search + count + export row */}
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Search by email…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="flex-1 rounded-lg px-3 py-1.5 text-sm bg-white/5 border border-white/10 outline-none focus:border-white/25 transition-colors"
                            style={{ color: 'var(--p-color-primary)' }}
                        />
                        <PText size="xs" color="contrast-low">{filtered.length} shown</PText>
                        <button
                            onClick={() => exportCsv(filtered, activeFilterLabel)}
                            disabled={filtered.length === 0}
                            className="text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-40"
                            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}
                            title={`Export ${filtered.length} rows as CSV`}
                        >
                            Export CSV
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                {['Email', 'Signed Up', 'Last Sign In', 'Status', ''].map(h => (
                                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--p-color-contrast-low)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(user => {
                                const status = resendStatus[user.id];
                                return (
                                    <tr
                                        key={user.id}
                                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                                        className="hover:bg-white/[0.03] transition-colors"
                                    >
                                        <td className="px-4 py-3" style={{ color: 'var(--p-color-primary)' }}>
                                            {user.email}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                            {formatDate(user.created_at)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--p-color-contrast-low)' }}>
                                            {formatDate(user.last_sign_in_at)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.confirmed ? (
                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                                                    Confirmed
                                                </span>
                                            ) : (
                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                                                    Unconfirmed
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {!user.confirmed && (
                                                <button
                                                    onClick={() => resendConfirmation(user.id, user.email)}
                                                    disabled={resending === user.id || status === 'sent'}
                                                    className="text-xs px-3 py-1 rounded-lg border transition-all disabled:opacity-50"
                                                    style={
                                                        status === 'sent'
                                                            ? { border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }
                                                            : status === 'error'
                                                            ? { border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }
                                                            : { border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }
                                                    }
                                                >
                                                    {resending === user.id ? 'Sending…'
                                                        : status === 'sent' ? '✓ Sent'
                                                        : status === 'error' ? 'Failed — retry'
                                                        : 'Resend activation'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center">
                                        <PText color="contrast-low">No users match your search.</PText>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
