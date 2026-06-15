import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification } from '@porsche-design-system/components-react';
import { createSong, updateSong, deleteSong, getAlbums } from '../../services/api';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";
const selectClass = "w-full rounded-lg border border-white/10 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent";
const labelClass = "block text-xs font-medium mb-1.5";

export default function SongForm({ song, onClose }) {
    const [formData, setFormData] = useState({
        title: '',
        is_original: true,
        original_artist: '',
        written_by: '',
        lyrics: '',
        notes: '',
        album_id: ''
    });
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        const fetchAlbums = async () => {
            try {
                const data = await getAlbums();
                setAlbums(data.albums || []);
            } catch (err) {
                console.error('Error fetching albums:', err);
            }
        };
        fetchAlbums();
    }, []);

    useEffect(() => {
        if (song) {
            setFormData({
                title: song.title || '',
                is_original: song.is_original ?? true,
                original_artist: song.original_artist || '',
                written_by: song.written_by || '',
                lyrics: song.lyrics || '',
                notes: song.notes || '',
                album_id: song.album_id || ''
            });
        }
    }, [song]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (song) {
                await updateSong(song.id, formData);
            } else {
                await createSong(formData);
            }
            onClose();
        } catch (err) {
            console.error('Error saving song:', err);
            setError(err.message || 'Failed to save song');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        setError(null);
        try {
            await deleteSong(song.id);
            onClose();
        } catch (err) {
            console.error('Error deleting song:', err);
            setError(err.message || 'Failed to delete song. This song may be used in setlists.');
            setShowDeleteConfirm(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PHeading size="2xl" tag="h1">{song ? 'Edit Song' : 'Add New Song'}</PHeading>
                <PButtonPure icon="close" onClick={onClose}>Close</PButtonPure>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Song Title <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <input type="text" name="title" value={formData.title} onChange={handleChange}
                        required placeholder="Enter song title" className={inputClass} />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
                    <input type="checkbox" name="is_original" id="is_original"
                        checked={formData.is_original} onChange={handleChange} className="w-4 h-4" />
                    <label htmlFor="is_original" className="cursor-pointer">
                        <PText size="small">This is an original song (not a cover)</PText>
                    </label>
                </div>

                {!formData.is_original && (
                    <div>
                        <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Original Artist
                        </label>
                        <input type="text" name="original_artist" value={formData.original_artist}
                            onChange={handleChange} placeholder="e.g., The Beatles, Bob Dylan" className={inputClass} />
                    </div>
                )}

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Written By</label>
                    <input type="text" name="written_by" value={formData.written_by} onChange={handleChange}
                        placeholder="e.g., John Lennon, Paul McCartney" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Album</label>
                    <select name="album_id" value={formData.album_id} onChange={handleChange}
                        className={selectClass}
                        style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                        <option value="">-- No Album / Unreleased --</option>
                        {albums.map(album => (
                            <option key={album.id} value={album.id}>
                                {album.title} ({new Date(album.release_date).getFullYear()}) - {album.album_type}
                            </option>
                        ))}
                    </select>
                    <PText size="x-small" color="contrast-low">
                        {formData.is_original
                            ? 'Select the album this song appears on (leave blank if unreleased)'
                            : 'Select an album if this cover was officially released by this artist'}
                    </PText>
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Lyrics</label>
                    <textarea name="lyrics" value={formData.lyrics} onChange={handleChange} rows="8"
                        placeholder="Enter song lyrics (optional)"
                        className={inputClass + ' resize-none font-mono'} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Notes</label>
                    <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3"
                        placeholder="Any additional notes about this song"
                        className={inputClass + ' resize-none'} />
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <div>
                        {song && (
                            <PButtonPure onClick={() => setShowDeleteConfirm(true)}
                                style={{ color: 'var(--p-color-error)' }}>
                                Delete Song
                            </PButtonPure>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <PButton type="button" variant="secondary" onClick={onClose}>Cancel</PButton>
                        <PButton type="submit" loading={loading}>
                            {song ? 'Update Song' : 'Create Song'}
                        </PButton>
                    </div>
                </div>
            </form>

            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 max-w-md w-full mx-4 space-y-4">
                        <PHeading size="lg" tag="h3">Delete Song?</PHeading>
                        <PText>
                            Are you sure you want to delete "{song?.title}"? This action cannot be undone.
                        </PText>
                        <PText size="small" style={{ color: 'var(--p-color-warning)' }}>
                            Note: Songs that are used in setlists cannot be deleted.
                        </PText>
                        <div className="flex gap-3 justify-end pt-2">
                            <PButton variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</PButton>
                            <PButton loading={loading} onClick={handleDelete}
                                style={{ '--p-button-primary-bg': 'var(--p-color-error)', '--p-button-primary-bg-hover': 'var(--p-color-error)' }}>
                                Delete
                            </PButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
