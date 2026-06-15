import { useState, useEffect, useCallback, useRef } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { createAlbum, updateAlbum, deleteAlbum, getSongs, getAlbumSongs, addSongToAlbum, removeSongFromAlbum, reorderAlbumSongs } from '../../services/api';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";
const selectClass = "w-full rounded-lg border border-white/10 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent";
const labelClass = "block text-xs font-medium mb-1.5";

function GripIcon() {
    return (
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
            <circle cx="3.5" cy="3" r="1.3" /><circle cx="8.5" cy="3" r="1.3" />
            <circle cx="3.5" cy="8" r="1.3" /><circle cx="8.5" cy="8" r="1.3" />
            <circle cx="3.5" cy="13" r="1.3" /><circle cx="8.5" cy="13" r="1.3" />
        </svg>
    );
}

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

    // Songs state
    const [albumSongs, setAlbumSongs] = useState([]);
    const [allSongs, setAllSongs] = useState([]);
    const [selectedSongId, setSelectedSongId] = useState('');
    const [songSearch, setSongSearch] = useState('');
    const [songsLoading, setSongsLoading] = useState(false);
    const [songError, setSongError] = useState(null);

    // Drag state
    const dragIndexRef = useRef(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

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

    const loadSongs = useCallback(async () => {
        if (!album) return;
        setSongsLoading(true);
        setSongError(null);
        try {
            const [albumData, allSongsData] = await Promise.all([
                getAlbumSongs(album.id),
                getSongs(),
            ]);
            setAlbumSongs(albumData.songs || []);
            setAllSongs(allSongsData.songs || []);
        } catch (err) {
            setSongError('Failed to load songs');
        } finally {
            setSongsLoading(false);
        }
    }, [album]);

    useEffect(() => { loadSongs(); }, [loadSongs]);

    const handleAddSong = async () => {
        if (!selectedSongId) return;
        setSongsLoading(true);
        setSongError(null);
        try {
            await addSongToAlbum(album.id, selectedSongId, albumSongs.length + 1);
            setSelectedSongId('');
            setSongSearch('');
            await loadSongs();
        } catch (err) {
            setSongError(err.message || 'Failed to add song to album');
            setSongsLoading(false);
        }
    };

    const handleRemoveSong = async (songId) => {
        setSongsLoading(true);
        setSongError(null);
        try {
            await removeSongFromAlbum(album.id, songId);
            const remaining = albumSongs.filter(s => s.id !== songId);
            if (remaining.length > 0) {
                await reorderAlbumSongs(album.id, remaining.map((s, idx) => ({
                    song_id: s.id,
                    track_order: idx + 1,
                })));
            }
            await loadSongs();
        } catch (err) {
            setSongError('Failed to remove song from album');
            setSongsLoading(false);
        }
    };

    // Drag handlers
    const handleDragStart = (e, index) => {
        dragIndexRef.current = index;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleDragLeave = () => setDragOverIndex(null);
    const handleDragEnd = () => { setDragOverIndex(null); dragIndexRef.current = null; };

    const handleDrop = async (e, dropIndex) => {
        e.preventDefault();
        setDragOverIndex(null);
        const dragIndex = dragIndexRef.current;
        dragIndexRef.current = null;
        if (dragIndex === null || dragIndex === dropIndex) return;

        // Optimistic reorder
        const reordered = [...albumSongs];
        const [moved] = reordered.splice(dragIndex, 1);
        reordered.splice(dropIndex, 0, moved);
        setAlbumSongs(reordered);

        // Persist
        setSongsLoading(true);
        try {
            await reorderAlbumSongs(album.id, reordered.map((song, idx) => ({
                song_id: song.id,
                track_order: idx + 1,
            })));
        } catch (err) {
            setSongError('Failed to save order. Reloading…');
            await loadSongs();
        } finally {
            setSongsLoading(false);
        }
    };

    const albumSongIds = new Set(albumSongs.map(s => s.id));
    const availableSongs = allSongs.filter(s =>
        !albumSongIds.has(s.id) &&
        (songSearch === '' || s.title.toLowerCase().includes(songSearch.toLowerCase()))
    ).sort((a, b) => {
        if (a.is_original !== b.is_original) return b.is_original - a.is_original;
        return a.title.localeCompare(b.title);
    });

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

            {/* Songs on this album — only shown when editing */}
            {album && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <PHeading size="lg" tag="h2">Songs on this Album</PHeading>
                        {albumSongs.length > 0 && (
                            <PText size="x-small" color="contrast-low">Drag to reorder</PText>
                        )}
                    </div>

                    {songError && (
                        <PInlineNotification heading="Error" description={songError} state="error" dismissButton={false} />
                    )}

                    {songsLoading && albumSongs.length === 0 ? (
                        <div className="flex items-center gap-3 py-2">
                            <PSpinner size="small" aria={{ 'aria-label': 'Loading songs' }} />
                            <PText size="small" color="contrast-medium">Loading…</PText>
                        </div>
                    ) : (
                        <>
                            {/* Draggable song list */}
                            {albumSongs.length > 0 ? (
                                <div className="space-y-1">
                                    {albumSongs.map((song, idx) => (
                                        <div
                                            key={song.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, idx)}
                                            onDragOver={(e) => handleDragOver(e, idx)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, idx)}
                                            onDragEnd={handleDragEnd}
                                            className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors select-none ${
                                                dragOverIndex === idx
                                                    ? 'border-amber-500/40 bg-amber-500/10'
                                                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                                            }`}
                                        >
                                            {/* Grip handle */}
                                            <div className="shrink-0 cursor-grab active:cursor-grabbing" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                <GripIcon />
                                            </div>

                                            {/* Track number */}
                                            <span className="shrink-0 text-xs w-5 text-right tabular-nums" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                {idx + 1}
                                            </span>

                                            {/* Song info */}
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="text-sm font-medium truncate" style={{ color: 'var(--p-color-primary)' }}>
                                                    {song.title}
                                                </span>
                                                {!song.is_original && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 whitespace-nowrap shrink-0">
                                                        Cover{song.original_artist ? ` · ${song.original_artist}` : ''}
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSong(song.id)}
                                                className="shrink-0 text-xs px-2 py-1 rounded border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-all"
                                                style={{ color: 'var(--p-color-contrast-low)' }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <PText size="small" color="contrast-medium">No songs associated with this album yet.</PText>
                            )}

                            {/* Add song */}
                            <div className="pt-4 border-t border-white/10 space-y-2">
                                <PText size="small" weight="semi-bold">Add Song</PText>
                                <input
                                    type="text"
                                    placeholder="Search songs…"
                                    value={songSearch}
                                    onChange={e => { setSongSearch(e.target.value); setSelectedSongId(''); }}
                                    className={inputClass}
                                />
                                <div className="flex gap-2">
                                    <select
                                        value={selectedSongId}
                                        onChange={e => setSelectedSongId(e.target.value)}
                                        className={selectClass + ' flex-1'}
                                        style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}
                                    >
                                        <option value="">Select a song…</option>
                                        {availableSongs.map(song => (
                                            <option key={song.id} value={song.id}>
                                                {song.title}{!song.is_original ? ` (Cover${song.original_artist ? ' · ' + song.original_artist : ''})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <PButton
                                        type="button"
                                        variant="secondary"
                                        size="small"
                                        disabled={!selectedSongId || songsLoading}
                                        onClick={handleAddSong}
                                    >
                                        Add
                                    </PButton>
                                </div>
                                {songSearch && availableSongs.length === 0 && (
                                    <PText size="x-small" color="contrast-low">No matching songs found.</PText>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

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
