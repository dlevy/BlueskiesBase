import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PButtonPure, PTag, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getAlbums } from '../../services/api';
import AlbumForm from './AlbumForm';

const ALBUM_TYPE_COLORS = {
    studio: 'notification-info',
    live: 'notification-success',
    compilation: 'notification-warning',
    ep: 'notification-success',
};

export default function AlbumsList() {
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingAlbum, setEditingAlbum] = useState(null);

    useEffect(() => { fetchAlbums(); }, []);

    const fetchAlbums = async () => {
        try {
            setLoading(true);
            const data = await getAlbums();
            setAlbums(data.albums || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching albums:', err);
            setError('Failed to load albums');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (album) => { setEditingAlbum(album); setShowForm(true); };
    const handleNew = () => { setEditingAlbum(null); setShowForm(true); };
    const handleFormClose = () => { setShowForm(false); setEditingAlbum(null); fetchAlbums(); };

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (loading) return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    if (error) return <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />;
    if (showForm) return <AlbumForm album={editingAlbum} onClose={handleFormClose} />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <PHeading size="2xl" tag="h1">Albums</PHeading>
                    <PText size="small" color="contrast-medium">
                        Manage albums for associating with original songs
                    </PText>
                </div>
                <PButton onClick={handleNew}>+ Add Album</PButton>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-4">
                <div className="text-3xl font-bold" style={{ color: 'var(--p-color-info)' }}>{albums.length}</div>
                <PText size="small" color="contrast-medium">Total Albums</PText>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'var(--p-color-surface)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-white/10" style={{ background: 'var(--p-color-canvas)' }}>
                            <tr>
                                {['Album Title', 'Artist', 'Release Date', 'Type', 'Actions'].map((h, i) => (
                                    <th key={h}
                                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}
                                        style={{ color: 'var(--p-color-contrast-medium)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {albums.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center">
                                        <PText color="contrast-medium">No albums found. Click "Add Album" to create one.</PText>
                                    </td>
                                </tr>
                            ) : (
                                albums.map((album) => (
                                    <tr key={album.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-4">
                                            <PText size="small" weight="semi-bold">{album.title}</PText>
                                            {album.notes && (
                                                <PText size="x-small" color="contrast-low">{album.notes}</PText>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <PText size="small" color="contrast-medium">{album.artist_name}</PText>
                                        </td>
                                        <td className="px-4 py-4">
                                            <PText size="small" color="contrast-medium">{formatDate(album.release_date)}</PText>
                                        </td>
                                        <td className="px-4 py-4">
                                            <PTag color={ALBUM_TYPE_COLORS[album.album_type] || 'background-surface'}>
                                                {album.album_type || 'unknown'}
                                            </PTag>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <PButtonPure size="x-small" onClick={() => handleEdit(album)}>Edit</PButtonPure>
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
