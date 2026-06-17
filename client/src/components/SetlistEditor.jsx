import { useState, useEffect, useCallback } from 'react';
import { PHeading, PText, PButton } from '@porsche-design-system/components-react';
import { getSongs } from '../services/api';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";
const selectClass = "w-full rounded-lg border border-white/10 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent";

export default function SetlistEditor({ initialSetlist = {}, onChange }) {
    const [setlist, setSetlist] = useState({ set1: [], set2: [], set3: [], encore: [] });
    const [allSongs, setAllSongs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSet, setSelectedSet] = useState('set1');
    const [showSongPicker, setShowSongPicker] = useState(false);

    const fetchSongs = useCallback(async () => {
        try {
            const data = await getSongs();
            setAllSongs(data.songs || []);
        } catch (err) {
            console.error('Error fetching songs:', err);
        }
    }, []);

    const convertInitialSetlist = useCallback((initial) => {
        const converted = { set1: [], set2: [], set3: [], encore: [] };
        Object.entries(initial).forEach(([setKey, songs]) => {
            if (songs && Array.isArray(songs)) {
                converted[setKey] = songs.map((song, index) => ({
                    id: song.id,
                    song_id: song.song_id || song.songs?.id,
                    title: song.title || song.songs?.title,
                    is_cover: song.is_cover || false,
                    original_artist: song.original_artist || null,
                    notes: song.notes || '',
                    jams_into: song.jams_into || null,
                    order: index
                }));
            }
        });
        setSetlist(converted);
    }, []);

    useEffect(() => { fetchSongs(); }, [fetchSongs]);
    useEffect(() => {
        if (initialSetlist && Object.keys(initialSetlist).length > 0) {
            convertInitialSetlist(initialSetlist);
        }
    }, [initialSetlist, convertInitialSetlist]);

    const handleAddSong = (song) => {
        const newSong = {
            id: `temp-${Date.now()}`,
            song_id: song.id,
            title: song.title,
            is_original: song.is_original,
            original_artist: song.original_artist,
            written_by: song.written_by,
            notes: '',
            jams_into: null,
            performance_type: 'full',
            order: setlist[selectedSet].length
        };
        const updatedSetlist = { ...setlist, [selectedSet]: [...setlist[selectedSet], newSong] };
        setSetlist(updatedSetlist);
        notifyChange(updatedSetlist);
        setShowSongPicker(false);
        setSearchTerm('');
    };

    const handleRemoveSong = (setKey, index) => {
        const updatedSetlist = { ...setlist, [setKey]: setlist[setKey].filter((_, i) => i !== index) };
        setSetlist(updatedSetlist);
        notifyChange(updatedSetlist);
    };

    const handleMoveSong = (setKey, index, direction) => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= setlist[setKey].length) return;
        const updatedSet = [...setlist[setKey]];
        [updatedSet[index], updatedSet[newIndex]] = [updatedSet[newIndex], updatedSet[index]];
        const updatedSetlist = { ...setlist, [setKey]: updatedSet };
        setSetlist(updatedSetlist);
        notifyChange(updatedSetlist);
    };

    const handleUpdateSong = (setKey, index, field, value) => {
        const updatedSet = [...setlist[setKey]];
        if (field === 'jams_into') {
            const nextSong = updatedSet[index + 1];
            updatedSet[index] = { ...updatedSet[index], [field]: value ? (nextSong ? nextSong.song_id : null) : null };
        } else {
            updatedSet[index] = { ...updatedSet[index], [field]: value };
        }
        const updatedSetlist = { ...setlist, [setKey]: updatedSet };
        setSetlist(updatedSetlist);
        notifyChange(updatedSetlist);
    };

    const notifyChange = (updatedSetlist) => {
        if (onChange) {
            const apiFormat = [];
            Object.entries(updatedSetlist).forEach(([setKey, songs]) => {
                const setNumber = setKey === 'encore' ? 1 : parseInt(setKey.replace('set', ''));
                const isEncore = setKey === 'encore';
                songs.forEach((song, index) => {
                    apiFormat.push({
                        song_id: song.song_id,
                        set_number: setNumber,
                        song_order: index + 1,
                        is_encore: isEncore,
                        notes: song.notes || null,
                        jams_into: song.jams_into || null,
                        performance_type: song.performance_type || 'full'
                    });
                });
            });
            onChange(apiFormat);
        }
    };

    const filteredSongs = allSongs.filter(song =>
        song.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const setLabels = { set1: 'Set 1', set2: 'Set 2', set3: 'Set 3', encore: 'Encore' };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PHeading size="lg" tag="h3">Setlist Editor</PHeading>
                <PButton type="button" onClick={() => setShowSongPicker(true)}>+ Add Song</PButton>
            </div>

            {/* Song Picker Modal */}
            {showSongPicker && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
                    <div className="rounded-2xl border border-white/10 p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col mx-4"
                        style={{ background: 'var(--p-color-canvas)' }}>
                        <div className="flex justify-between items-center mb-4">
                            <PHeading size="lg" tag="h4">Add Song to {setLabels[selectedSet]}</PHeading>
                            <button onClick={() => { setShowSongPicker(false); setSearchTerm(''); }}
                                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--p-color-contrast-medium)' }}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Add to:
                            </label>
                            <select value={selectedSet} onChange={e => setSelectedSet(e.target.value)}
                                className={selectClass}
                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                <option value="set1">Set 1</option>
                                <option value="set2">Set 2</option>
                                <option value="set3">Set 3</option>
                                <option value="encore">Encore</option>
                            </select>
                        </div>

                        <input type="text" placeholder="Search songs..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className={inputClass + ' mb-4'} autoFocus />

                        <div className="flex-1 overflow-y-auto rounded-xl border border-white/10"
                            style={{ background: 'var(--p-color-surface)' }}>
                            {filteredSongs.map(song => (
                                <button key={song.id} onClick={() => handleAddSong(song)}
                                    className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-b-0 transition-colors">
                                    <PText size="small" weight="semi-bold">{song.title}</PText>
                                    {song.original_artist && (
                                        <PText size="x-small" color="contrast-medium">Cover of {song.original_artist}</PText>
                                    )}
                                </button>
                            ))}
                            {filteredSongs.length === 0 && (
                                <div className="text-center py-8">
                                    <PText color="contrast-medium">No songs found</PText>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Setlist Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(setlist).map(([setKey, songs]) => (
                    <div key={setKey} className="rounded-xl border border-white/10 p-4"
                        style={{ background: 'var(--p-color-surface)' }}>
                        <PHeading size="sm" tag="h4" className="mb-3">{setLabels[setKey]}</PHeading>

                        {songs.length === 0 ? (
                            <PText size="small" style={{ color: 'var(--p-color-contrast-low)' }}>No songs yet</PText>
                        ) : (
                            <div className="space-y-2">
                                {songs.map((song, index) => (
                                    <SetlistSongItem
                                        key={`${setKey}-${index}`}
                                        song={song}
                                        index={index}
                                        setKey={setKey}
                                        isFirst={index === 0}
                                        isLast={index === songs.length - 1}
                                        onRemove={() => handleRemoveSong(setKey, index)}
                                        onMove={(direction) => handleMoveSong(setKey, index, direction)}
                                        onUpdate={(field, value) => handleUpdateSong(setKey, index, field, value)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function SetlistSongItem({ song, index, setKey, isFirst, isLast, onRemove, onMove, onUpdate }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="rounded-lg border border-white/10 p-2" style={{ background: 'var(--p-color-canvas)' }}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-mono shrink-0" style={{ color: 'var(--p-color-contrast-medium)' }}>
                        {index + 1}.
                    </span>
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--p-color-primary)' }}>
                        {song.title}
                    </span>
                    {song.is_original === true && (
                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded border"
                            style={{ color: 'var(--p-color-success)', borderColor: 'var(--p-color-success)', background: 'color-mix(in srgb, var(--p-color-success) 10%, transparent)' }}>
                            Original
                        </span>
                    )}
                    {song.is_original === false && (
                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded border"
                            style={{ color: 'var(--p-color-info)', borderColor: 'var(--p-color-info)', background: 'color-mix(in srgb, var(--p-color-info) 10%, transparent)' }}>
                            Cover
                        </span>
                    )}
                    {song.jams_into && (
                        <span className="shrink-0 text-xs px-1 py-0.5 rounded font-bold"
                            style={{ color: 'var(--p-color-primary)', borderColor: 'currentColor', border: '1px solid' }}>
                            &gt;
                        </span>
                    )}
                </div>
                <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => setIsExpanded(!isExpanded)}
                        className="px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-xs"
                        style={{ color: 'var(--p-color-contrast-medium)' }} title="Edit details">
                        ⚙
                    </button>
                    <button type="button" onClick={() => onMove('up')} disabled={isFirst}
                        className="px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-sm disabled:opacity-30"
                        style={{ color: 'var(--p-color-contrast-medium)' }} title="Move up">
                        ↑
                    </button>
                    <button type="button" onClick={() => onMove('down')} disabled={isLast}
                        className="px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-sm disabled:opacity-30"
                        style={{ color: 'var(--p-color-contrast-medium)' }} title="Move down">
                        ↓
                    </button>
                    <button type="button" onClick={onRemove}
                        className="px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-sm"
                        style={{ color: 'var(--p-color-error)' }} title="Remove">
                        ×
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                    {song.original_artist && (
                        <PText size="x-small" color="contrast-medium">
                            <span className="font-semibold">Original Artist:</span> {song.original_artist}
                        </PText>
                    )}
                    {song.written_by && (
                        <PText size="x-small" color="contrast-medium">
                            <span className="font-semibold">Written By:</span> {song.written_by}
                        </PText>
                    )}

                    <div className="pt-2 border-t border-white/10 space-y-2">
                        <div>
                            <label className="block text-xs mb-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Performance Type
                            </label>
                            <select value={song.performance_type || 'full'}
                                onChange={e => onUpdate('performance_type', e.target.value)}
                                className="w-full rounded border border-white/10 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--p-color-info)]"
                                style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                                <option value="full">Full Performance</option>
                                <option value="tease">Tease</option>
                                <option value="partial">Partial</option>
                            </select>
                        </div>

                        <label className="flex items-center gap-2 text-xs cursor-pointer"
                            style={{ color: 'var(--p-color-contrast-medium)' }}>
                            <input type="checkbox" checked={!!song.jams_into}
                                onChange={e => onUpdate('jams_into', e.target.checked)} className="w-3 h-3" />
                            Jams into next song
                            <span className="font-bold" style={{ color: 'var(--p-color-primary)' }}>&gt;</span>
                        </label>

                        <input type="text" placeholder="Performance notes (e.g., 'with guest', 'acoustic version')"
                            value={song.notes || ''} onChange={e => onUpdate('notes', e.target.value)}
                            className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--p-color-info)] placeholder:text-gray-500" />
                    </div>

                    <PText size="x-small" style={{ color: 'var(--p-color-contrast-low)' }} className="pt-1 border-t border-white/10">
                        To change song metadata, edit the song in the Songs admin panel.
                    </PText>
                </div>
            )}
        </div>
    );
}
