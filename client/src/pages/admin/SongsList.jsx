import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PHeading, PText, PButton, PButtonPure, PTag, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getSongs } from '../../services/api';
import SongForm from './SongForm';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

export default function SongsList() {
    const [songs, setSongs] = useState([]);
    const [filteredSongs, setFilteredSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [editingSong, setEditingSong] = useState(null);
    const [stats, setStats] = useState({ total: 0, original: 0, covers: 0 });

    useEffect(() => { fetchSongs(); }, []);
    useEffect(() => { filterSongs(); }, [songs, searchTerm, filterType]);

    const fetchSongs = async () => {
        try {
            setLoading(true);
            const data = await getSongs();
            setSongs(data.songs || []);
            const total = data.songs?.length || 0;
            const original = data.songs?.filter(s => s.is_original).length || 0;
            setStats({ total, original, covers: total - original });
            setError(null);
        } catch (err) {
            console.error('Error fetching songs:', err);
            setError('Failed to load songs');
        } finally {
            setLoading(false);
        }
    };

    const filterSongs = () => {
        let filtered = songs;
        if (filterType === 'original') filtered = filtered.filter(s => s.is_original);
        else if (filterType === 'cover') filtered = filtered.filter(s => !s.is_original);
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                s.title.toLowerCase().includes(term) ||
                s.original_artist?.toLowerCase().includes(term) ||
                s.written_by?.toLowerCase().includes(term)
            );
        }
        setFilteredSongs(filtered);
    };

    const handleEdit = (song) => { setEditingSong(song); setShowForm(true); };
    const handleNew = () => { setEditingSong(null); setShowForm(true); };
    const handleFormClose = () => { setShowForm(false); setEditingSong(null); fetchSongs(); };

    if (loading) return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    if (error) return <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />;
    if (showForm) return <SongForm song={editingSong} onClose={handleFormClose} />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <PHeading size="2xl" tag="h1">Manage Songs</PHeading>
                    <PText size="small" color="contrast-medium">
                        {stats.total} total songs ({stats.original} original, {stats.covers} covers)
                    </PText>
                </div>
                <PButton onClick={handleNew}>+ Add New Song</PButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Songs', value: stats.total, color: 'var(--p-color-primary)' },
                    { label: 'Original Songs', value: stats.original, color: 'var(--p-color-success)' },
                    { label: 'Cover Songs', value: stats.covers, color: 'var(--p-color-info)' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-4">
                        <PText size="small" color="contrast-medium">{label}</PText>
                        <div className="text-3xl font-bold mt-1" style={{ color }}>{value}</div>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Search Songs
                        </label>
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by title, artist, or writer..." className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Filter by Type
                        </label>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)}
                            className="w-full rounded-lg border border-white/10 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent"
                            style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                            <option value="all">All Songs</option>
                            <option value="original">Original Songs Only</option>
                            <option value="cover">Cover Songs Only</option>
                        </select>
                    </div>
                </div>
                <PText size="x-small" color="contrast-low">
                    Showing {filteredSongs.length} of {songs.length} songs
                </PText>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'var(--p-color-surface)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-white/10" style={{ background: 'var(--p-color-canvas)' }}>
                            <tr>
                                {['Title', 'Type', 'Original Artist', 'Album', 'Shows', 'Actions'].map((h, i) => (
                                    <th key={h}
                                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i >= 4 ? 'text-right' : 'text-left'}`}
                                        style={{ color: 'var(--p-color-contrast-medium)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredSongs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center">
                                        <PText color="contrast-medium">No songs found</PText>
                                    </td>
                                </tr>
                            ) : (
                                filteredSongs.map((song) => (
                                    <tr key={song.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3">
                                            <PText size="small" weight="semi-bold">{song.title}</PText>
                                        </td>
                                        <td className="px-4 py-3">
                                            <PTag color={song.is_original ? 'notification-success' : 'notification-info'}>
                                                {song.is_original ? 'Original' : 'Cover'}
                                            </PTag>
                                        </td>
                                        <td className="px-4 py-3">
                                            <PText size="small" color="contrast-medium">{song.original_artist || '-'}</PText>
                                        </td>
                                        <td className="px-4 py-3">
                                            {song.album_songs?.length > 0
                                                ? <div className="flex flex-col gap-0.5">
                                                    {song.album_songs.map(as => as.albums?.title).filter(Boolean).map(title => (
                                                        <PText key={title} size="small" color="contrast-medium">{title}</PText>
                                                    ))}
                                                  </div>
                                                : <PText size="small" color="contrast-medium">-</PText>
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {song.performance_count > 0 ? (
                                                <Link to={`/?song=${encodeURIComponent(song.title)}`}
                                                    title={`View ${song.performance_count} show${song.performance_count !== 1 ? 's' : ''}`}
                                                    className="text-sm font-medium hover:underline"
                                                    style={{ color: 'var(--p-color-info)' }}>
                                                    {song.performance_count}
                                                </Link>
                                            ) : (
                                                <span className="text-sm font-medium" style={{ color: 'var(--p-color-contrast-low)' }}>0</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <PButtonPure size="x-small" onClick={() => handleEdit(song)}>Edit</PButtonPure>
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
