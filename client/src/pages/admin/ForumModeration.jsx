import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import {
    getForumCategories, createForumCategory, updateForumCategory, deleteForumCategory,
    getForumReports, resolveForumReport,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { buildThreadPath } from '../../utils/forumSlug';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

// Same inline-panel pattern as LinksList.jsx's CategoriesPanel — forum
// categories are expected to stay small in number too.
function CategoriesPanel({ categories, isAdmin, onChanged }) {
    const [expanded, setExpanded] = useState(false);
    const [newName, setNewName] = useState('');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        setError(null);
        try {
            await createForumCategory(newName.trim());
            setNewName('');
            await onChanged();
        } catch (err) {
            setError(err.message || 'Failed to add category');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (category) => { setEditingId(category.id); setEditingName(category.name); };

    const saveEdit = async () => {
        if (!editingName.trim()) return;
        setSaving(true);
        setError(null);
        try {
            await updateForumCategory(editingId, { name: editingName.trim() });
            setEditingId(null);
            await onChanged();
        } catch (err) {
            setError(err.message || 'Failed to rename category');
        } finally {
            setSaving(false);
        }
    };

    const move = async (category, direction) => {
        const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
        const index = sorted.findIndex(c => c.id === category.id);
        const swapIndex = index + direction;
        if (swapIndex < 0 || swapIndex >= sorted.length) return;
        const neighbor = sorted[swapIndex];

        setSaving(true);
        setError(null);
        try {
            await Promise.all([
                updateForumCategory(category.id, { sort_order: neighbor.sort_order }),
                updateForumCategory(neighbor.id, { sort_order: category.sort_order }),
            ]);
            await onChanged();
        } catch (err) {
            setError(err.message || 'Failed to reorder categories');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (category) => {
        if (!isAdmin) return;
        if (!confirm(`Delete category "${category.name}"? Threads in this category will move to "Other" — they won't be deleted.`)) return;
        setSaving(true);
        setError(null);
        try {
            await deleteForumCategory(category.id);
            await onChanged();
        } catch (err) {
            setError(err.message || 'Failed to delete category');
        } finally {
            setSaving(false);
        }
    };

    // At most one category ever carries this — toggling it on here clears it
    // from whichever one had it before (server-enforced too, via a partial
    // unique index), so this always behaves like a radio button, not a
    // per-row checkbox.
    const toggleShowDiscussion = async (category) => {
        setSaving(true);
        setError(null);
        try {
            await updateForumCategory(category.id, { is_show_discussion_category: !category.is_show_discussion_category });
            await onChanged();
        } catch (err) {
            setError(err.message || 'Failed to update category');
        } finally {
            setSaving(false);
        }
    };

    const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] overflow-hidden">
            <button type="button" onClick={() => setExpanded(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
                <PHeading size="sm" tag="h2">Manage Categories</PHeading>
                <svg aria-hidden="true"
                    className={`w-4 h-4 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="border-t border-white/10 px-4 py-4 space-y-3">
                    {error && <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />}
                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        ★ marks the category where "Start Discussion" on a show page files its auto-created thread.
                    </PText>

                    {sortedCategories.map((category, i) => (
                        <div key={category.id} className="flex items-center gap-2">
                            {editingId === category.id ? (
                                <>
                                    <input type="text" value={editingName} onChange={e => setEditingName(e.target.value)} className={inputClass} autoFocus />
                                    <PButtonPure size="x-small" disabled={saving} onClick={saveEdit}>Save</PButtonPure>
                                    <PButtonPure size="x-small" disabled={saving} onClick={() => setEditingId(null)}>Cancel</PButtonPure>
                                </>
                            ) : (
                                <>
                                    <PText size="small" className="flex-1">
                                        {category.name}
                                        {category.is_show_discussion_category && (
                                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                Show Discussions
                                            </span>
                                        )}
                                    </PText>
                                    {isAdmin && (
                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => toggleShowDiscussion(category)}
                                            title={category.is_show_discussion_category ? 'Stop using for show discussions' : 'Use for show discussions'}
                                            className="text-xs px-1.5"
                                            style={{ color: category.is_show_discussion_category ? '#f59e0b' : 'var(--p-color-contrast-low)' }}
                                        >
                                            ★
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <>
                                            <button type="button" disabled={saving || i === 0} onClick={() => move(category, -1)}
                                                className="text-xs px-1.5 disabled:opacity-30" style={{ color: 'var(--p-color-contrast-medium)' }}>↑</button>
                                            <button type="button" disabled={saving || i === sortedCategories.length - 1} onClick={() => move(category, 1)}
                                                className="text-xs px-1.5 disabled:opacity-30" style={{ color: 'var(--p-color-contrast-medium)' }}>↓</button>
                                            <PButtonPure size="x-small" disabled={saving} onClick={() => startEdit(category)}>Rename</PButtonPure>
                                            <PButtonPure size="x-small" disabled={saving} onClick={() => handleDelete(category)} style={{ color: 'var(--p-color-notification-error)' }}>
                                                Delete
                                            </PButtonPure>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    ))}

                    {isAdmin && (
                        <div className="flex gap-2 pt-2 border-t border-white/10">
                            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="New category name…" className={inputClass} />
                            <PButton size="small" disabled={saving || !newName.trim()} onClick={handleAdd}>+ Add</PButton>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ReportRow({ report, onResolve, resolving }) {
    const reporterName = report.reporter?.display_name || report.reporter?.username || 'Someone';
    const [reason, note] = (report.message || '').split(/:\s(.+)/s);
    return (
        <div className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <PText size="sm">
                        Reported by <strong>{reporterName}</strong> as <strong>{reason}</strong>{note ? ` — "${note}"` : ''}
                    </PText>
                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {report.contentType === 'forum_reply' ? 'Reply in' : 'Thread'}: {report.threadTitle || '(deleted)'}
                    </PText>
                    {report.excerpt && (
                        <PText size="xs" style={{ color: 'var(--p-color-contrast-medium)' }} className="mt-1 block italic">
                            "{report.excerpt.length > 140 ? report.excerpt.slice(0, 140) + '…' : report.excerpt}"
                        </PText>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {report.threadId && (
                        <Link to={buildThreadPath(report.threadId)} target="_blank">
                            <PButtonPure size="x-small">View</PButtonPure>
                        </Link>
                    )}
                    <PButtonPure size="x-small" disabled={resolving} onClick={() => onResolve(report)}>
                        Resolve
                    </PButtonPure>
                </div>
            </div>
        </div>
    );
}

export default function ForumModeration() {
    const { isAdmin } = useAuth();
    const [categories, setCategories] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [resolvingKey, setResolvingKey] = useState(null);

    const loadCategories = useCallback(async () => {
        const data = await getForumCategories();
        setCategories((data.categories || []).filter(c => c.id));
    }, []);

    const loadReports = useCallback(async () => {
        const data = await getForumReports();
        setReports(data.reports || []);
    }, []);

    useEffect(() => {
        Promise.all([loadCategories(), loadReports()])
            .catch(err => {
                console.error('[ForumModeration] Error loading:', err);
                setError('Failed to load forum moderation data');
            })
            .finally(() => setLoading(false));
    }, [loadCategories, loadReports]);

    const handleResolve = async (report) => {
        const key = `${report.contentType}:${report.contentId}`;
        setResolvingKey(key);
        try {
            await resolveForumReport(report.contentType, report.contentId);
            await loadReports();
        } catch (err) {
            console.error('[ForumModeration] Error resolving report:', err);
            setError(err.message || 'Failed to resolve report');
        } finally {
            setResolvingKey(null);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PHeading size="2xl" tag="h1">Forum Moderation</PHeading>
                {/* "View Forum" link hidden along with the rest of the public forum links — uncomment to re-enable. */}
                {/* <Link to="/forum" target="_blank">
                    <PButton variant="secondary">View Forum</PButton>
                </Link> */}
            </div>

            {error && <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />}

            <CategoriesPanel categories={categories} isAdmin={isAdmin} onChanged={loadCategories} />

            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5 space-y-3">
                <PHeading size="sm" tag="h2">Open Reports ({reports.length})</PHeading>
                {reports.length === 0 ? (
                    <PText color="contrast-medium">No open reports.</PText>
                ) : (
                    <div className="space-y-2">
                        {reports.map(report => (
                            <ReportRow
                                key={`${report.contentType}:${report.contentId}`}
                                report={report}
                                onResolve={handleResolve}
                                resolving={resolvingKey === `${report.contentType}:${report.contentId}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
