import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getLinks, getLinkCategories, createLinkCategory, updateLinkCategory, deleteLinkCategory } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LinkForm from './LinkForm';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

// Categories are expected to stay in the single digits forever (unlike the
// Songs/Albums catalogs), so this is a lightweight inline panel rather than a
// separate List+Form pair with its own route.
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
            await createLinkCategory(newName.trim());
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
            await updateLinkCategory(editingId, { name: editingName.trim() });
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
                updateLinkCategory(category.id, { sort_order: neighbor.sort_order }),
                updateLinkCategory(neighbor.id, { sort_order: category.sort_order }),
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
        if (!confirm(`Delete category "${category.name}"? Links in this category will move to "Other" — they won't be deleted.`)) return;
        setSaving(true);
        setError(null);
        try {
            await deleteLinkCategory(category.id);
            await onChanged();
        } catch (err) {
            setError(err.message || 'Failed to delete category');
        } finally {
            setSaving(false);
        }
    };

    const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3"
            >
                <PHeading size="sm" tag="h2">Manage Categories</PHeading>
                <svg
                    className={`w-4 h-4 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="border-t border-white/10 px-4 py-4 space-y-3">
                    {error && <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />}

                    {sortedCategories.map((category, i) => (
                        <div key={category.id} className="flex items-center gap-2">
                            {editingId === category.id ? (
                                <>
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={e => setEditingName(e.target.value)}
                                        className={inputClass}
                                        autoFocus
                                    />
                                    <PButtonPure size="x-small" disabled={saving} onClick={saveEdit}>Save</PButtonPure>
                                    <PButtonPure size="x-small" disabled={saving} onClick={() => setEditingId(null)}>Cancel</PButtonPure>
                                </>
                            ) : (
                                <>
                                    <PText size="small" className="flex-1">{category.name}</PText>
                                    <button type="button" disabled={saving || i === 0} onClick={() => move(category, -1)}
                                        className="text-xs px-1.5 disabled:opacity-30" style={{ color: 'var(--p-color-contrast-medium)' }}>↑</button>
                                    <button type="button" disabled={saving || i === sortedCategories.length - 1} onClick={() => move(category, 1)}
                                        className="text-xs px-1.5 disabled:opacity-30" style={{ color: 'var(--p-color-contrast-medium)' }}>↓</button>
                                    <PButtonPure size="x-small" disabled={saving} onClick={() => startEdit(category)}>Rename</PButtonPure>
                                    {isAdmin && (
                                        <PButtonPure size="x-small" disabled={saving} onClick={() => handleDelete(category)}
                                            style={{ color: 'var(--p-color-notification-error)' }}>
                                            Delete
                                        </PButtonPure>
                                    )}
                                </>
                            )}
                        </div>
                    ))}

                    <div className="flex gap-2 pt-2 border-t border-white/10">
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="New category name…"
                            className={inputClass}
                        />
                        <PButton size="small" disabled={saving || !newName.trim()} onClick={handleAdd}>+ Add</PButton>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function LinksList() {
    const { isAdmin } = useAuth();
    const [links, setLinks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingLink, setEditingLink] = useState(null);

    // Only the very first load shows the full-page spinner. Refetches
    // triggered by category add/rename/reorder/delete (via CategoriesPanel's
    // onChanged) must NOT fall back to it — that would unmount CategoriesPanel
    // and reset its "expanded" state, kicking the admin back out of the panel
    // they were mid-reorder in.
    const [initialLoading, setInitialLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [linksData, categoriesData] = await Promise.all([getLinks(), getLinkCategories()]);
            setLinks(linksData.links || []);
            setCategories(categoriesData.categories || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching links:', err);
            setError('Failed to load links');
        } finally {
            setInitialLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleEdit = (link) => { setEditingLink(link); setShowForm(true); };
    const handleNew = () => { setEditingLink(null); setShowForm(true); };
    const handleFormClose = () => { setShowForm(false); setEditingLink(null); fetchData(); };

    if (initialLoading) return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    if (error) return <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />;
    if (showForm) return <LinkForm link={editingLink} categories={categories} onClose={handleFormClose} />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <PHeading size="2xl" tag="h1">Links</PHeading>
                    <PText size="small" color="contrast-medium">
                        Manage the public /links page — news, video channels, communities, poster artists, and any other JBS-affiliated sites
                    </PText>
                </div>
                <PButton onClick={handleNew}>+ Add Link</PButton>
            </div>

            <CategoriesPanel categories={categories} isAdmin={isAdmin} onChanged={fetchData} />

            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'var(--p-color-surface)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-white/10" style={{ background: 'var(--p-color-canvas)' }}>
                            <tr>
                                {['Title', 'Category', 'Member', 'URL', 'Actions'].map((h, i) => (
                                    <th key={h}
                                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}
                                        style={{ color: 'var(--p-color-contrast-medium)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {links.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center">
                                        <PText color="contrast-medium">No links found. Click "Add Link" to create one.</PText>
                                    </td>
                                </tr>
                            ) : (
                                links.map((link) => (
                                    <tr key={link.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3">
                                            <PText size="small" weight="semi-bold">{link.title}</PText>
                                            {link.description && (
                                                <PText size="x-small" color="contrast-medium">{link.description}</PText>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <PText size="small" color="contrast-medium">{link.link_categories?.name || 'Other'}</PText>
                                        </td>
                                        <td className="px-4 py-3">
                                            <PText size="small" color="contrast-medium">
                                                {link.member ? (link.member.display_name || link.member.username) : '—'}
                                            </PText>
                                        </td>
                                        <td className="px-4 py-3 max-w-xs">
                                            <PText size="small" color="contrast-medium" ellipsis>{link.url}</PText>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <PButtonPure size="x-small" onClick={() => handleEdit(link)}>Edit</PButtonPure>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
