import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification } from '@porsche-design-system/components-react';
import { createLink, updateLink, deleteLink } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";
const selectClass = "w-full rounded-lg border border-white/10 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent";
const labelClass = "block text-xs font-medium mb-1.5";

export default function LinkForm({ link, categories, onClose }) {
    const { isAdmin } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        url: '',
        description: '',
        category_id: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (link) {
            setFormData({
                title: link.title || '',
                url: link.url || '',
                description: link.description || '',
                category_id: link.category_id || '',
            });
        }
    }, [link]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const payload = { ...formData, category_id: formData.category_id || null };
            if (link) {
                await updateLink(link.id, payload);
            } else {
                await createLink(payload);
            }
            onClose();
        } catch (err) {
            console.error('Error saving link:', err);
            setError(err.message || 'Failed to save link');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        setError(null);
        try {
            await deleteLink(link.id);
            onClose();
        } catch (err) {
            console.error('Error deleting link:', err);
            setError(err.message || 'Failed to delete link');
            setShowDeleteConfirm(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PHeading size="2xl" tag="h1">{link ? 'Edit Link' : 'Add New Link'}</PHeading>
                <PButtonPure icon="close" onClick={onClose}>Close</PButtonPure>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Title <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <input type="text" name="title" value={formData.title} onChange={handleChange}
                        required placeholder="e.g., JBS Fan Wiki" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        URL <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <input type="url" name="url" value={formData.url} onChange={handleChange}
                        required placeholder="https://example.com" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Category</label>
                    <select name="category_id" value={formData.category_id} onChange={handleChange}
                        className={selectClass}
                        style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                        <option value="">— Other (uncategorized) —</option>
                        {categories.map(category => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Description</label>
                    <textarea name="description" value={formData.description} onChange={handleChange} rows={3}
                        placeholder="Optional short blurb shown under the link…"
                        className={inputClass + ' resize-none'} />
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/10">
                    <PButton type="submit" loading={loading}>
                        {link ? 'Update Link' : 'Create Link'}
                    </PButton>
                    <PButton type="button" variant="secondary" disabled={loading} onClick={onClose}>
                        Cancel
                    </PButton>
                </div>
            </form>

            {link && isAdmin && (
                <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--p-color-error)' }}>
                    <PHeading size="lg" tag="h2" style={{ color: 'var(--p-color-error)' }}>Danger Zone</PHeading>
                    <PText size="small" color="contrast-medium">
                        Deleting this link removes it from the public Links page.
                    </PText>

                    {!showDeleteConfirm ? (
                        <PButton variant="secondary" disabled={loading}
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{ '--p-button-secondary-color': 'var(--p-color-error)', '--p-button-secondary-border-color': 'var(--p-color-error)' }}>
                            Delete Link
                        </PButton>
                    ) : (
                        <div className="space-y-3">
                            <PText weight="semi-bold" style={{ color: 'var(--p-color-error)' }}>
                                Are you sure? This action cannot be undone.
                            </PText>
                            <div className="flex gap-3">
                                <PButton loading={loading} onClick={handleDelete}
                                    style={{ '--p-button-primary-bg': 'var(--p-color-error)' }}>
                                    {loading ? 'Deleting...' : 'Yes, Delete Link'}
                                </PButton>
                                <PButton variant="secondary" disabled={loading}
                                    onClick={() => setShowDeleteConfirm(false)}>
                                    Cancel
                                </PButton>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
