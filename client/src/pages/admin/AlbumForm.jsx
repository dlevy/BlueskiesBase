import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification } from '@porsche-design-system/components-react';
import { createAlbum, updateAlbum, deleteAlbum } from '../../services/api';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";
const selectClass = "w-full rounded-lg border border-white/10 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent";
const labelClass = "block text-xs font-medium mb-1.5";

export default function AlbumForm({ album, onClose }) {
    const [formData, setFormData] = useState({
        title: '',
        artist_name: 'Johnny Blue Skies',
        release_date: '',
        album_art_url: '',
        album_type: 'studio',
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (album) {
            setFormData({
                title: album.title || '',
                artist_name: album.artist_name || 'Johnny Blue Skies',
                release_date: album.release_date ? album.release_date.split('T')[0] : '',
                album_art_url: album.album_art_url || '',
                album_type: album.album_type || 'studio',
                notes: album.notes || ''
            });
        }
    }, [album]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (album) {
                await updateAlbum(album.id, formData);
            } else {
                await createAlbum(formData);
            }
            onClose();
        } catch (err) {
            console.error('Error saving album:', err);
            setError(err.message || 'Failed to save album');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        setError(null);
        try {
            await deleteAlbum(album.id);
            onClose();
        } catch (err) {
            console.error('Error deleting album:', err);
            setError(err.message || 'Failed to delete album');
            setShowDeleteConfirm(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PHeading size="2xl" tag="h1">{album ? 'Edit Album' : 'Add New Album'}</PHeading>
                <PButtonPure icon="close" onClick={onClose}>Close</PButtonPure>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Album Title <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <input type="text" name="title" value={formData.title} onChange={handleChange}
                        required placeholder="e.g., Passage Du Desir" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Artist Name <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <input type="text" name="artist_name" value={formData.artist_name} onChange={handleChange}
                        required placeholder="e.g., Johnny Blue Skies, Sturgill Simpson" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Release Date</label>
                    <input type="date" name="release_date" value={formData.release_date}
                        onChange={handleChange} className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Album Type <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <select name="album_type" value={formData.album_type} onChange={handleChange} required
                        className={selectClass}
                        style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                        <option value="studio">Studio</option>
                        <option value="live">Live</option>
                        <option value="compilation">Compilation</option>
                        <option value="ep">EP</option>
                        <option value="single">Single</option>
                    </select>
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Album Art URL</label>
                    <input type="url" name="album_art_url" value={formData.album_art_url} onChange={handleChange}
                        placeholder="https://example.com/album-cover.jpg" className={inputClass} />
                    <PText size="x-small" color="contrast-low">Optional: URL to album artwork image</PText>
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Notes</label>
                    <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3}
                        placeholder="Additional notes about this album..."
                        className={inputClass + ' resize-none'} />
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/10">
                    <PButton type="submit" loading={loading}>
                        {album ? 'Update Album' : 'Create Album'}
                    </PButton>
                    <PButton type="button" variant="secondary" disabled={loading} onClick={onClose}>
                        Cancel
                    </PButton>
                </div>
            </form>

            {album && (
                <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--p-color-error)' }}>
                    <PHeading size="lg" tag="h2" style={{ color: 'var(--p-color-error)' }}>Danger Zone</PHeading>
                    <PText size="small" color="contrast-medium">
                        Deleting this album will remove it from all associated songs. Songs will not be deleted,
                        but their album association will be removed.
                    </PText>

                    {!showDeleteConfirm ? (
                        <PButton variant="secondary" disabled={loading}
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{ '--p-button-secondary-color': 'var(--p-color-error)', '--p-button-secondary-border-color': 'var(--p-color-error)' }}>
                            Delete Album
                        </PButton>
                    ) : (
                        <div className="space-y-3">
                            <PText weight="semi-bold" style={{ color: 'var(--p-color-error)' }}>
                                Are you sure? This action cannot be undone.
                            </PText>
                            <div className="flex gap-3">
                                <PButton loading={loading} onClick={handleDelete}
                                    style={{ '--p-button-primary-bg': 'var(--p-color-error)' }}>
                                    {loading ? 'Deleting...' : 'Yes, Delete Album'}
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
