import { useState, useEffect, useCallback } from 'react';
import { getSongs } from '../services/api';

export default function SetlistEditor({ initialSetlist = {}, onChange }) {
    const [setlist, setSetlist] = useState({
        set1: [],
        set2: [],
        set3: [],
        encore: []
    });
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
        const converted = {
            set1: [],
            set2: [],
            set3: [],
            encore: []
        };

        Object.entries(initial).forEach(([setKey, songs]) => {
            if (songs && Array.isArray(songs)) {
                converted[setKey] = songs.map((song, index) => ({
                    id: song.id,
                    song_id: song.song_id || song.songs?.id,
                    title: song.title || song.songs?.title,
                    is_cover: song.is_cover || false,
                    original_artist: song.original_artist || null,
                    notes: song.notes || '',
                    jams_into: song.jams_into || null,  // UUID or null, NOT false
                    order: index
                }));
            }
        });

        setSetlist(converted);
    }, []);

    useEffect(() => {
        fetchSongs();
    }, [fetchSongs]);

    useEffect(() => {
        if (initialSetlist && Object.keys(initialSetlist).length > 0) {
            convertInitialSetlist(initialSetlist);
        }
    }, [initialSetlist, convertInitialSetlist]);

    const handleAddSong = (song) => {
        const newSong = {
            id: `temp-${Date.now()}`, // Temporary ID for new songs
            song_id: song.id,
            title: song.title,
            // Song metadata comes from songs table
            is_original: song.is_original,
            original_artist: song.original_artist,
            written_by: song.written_by,
            // Performance-specific fields only
            notes: '',
            jams_into: null,  // UUID or null, NOT false
            order: setlist[selectedSet].length
        };

        const updatedSetlist = {
            ...setlist,
            [selectedSet]: [...setlist[selectedSet], newSong]
        };

        setSetlist(updatedSetlist);
        notifyChange(updatedSetlist);
        setShowSongPicker(false);
        setSearchTerm('');
    };

    const handleRemoveSong = (setKey, index) => {
        const updatedSet = setlist[setKey].filter((_, i) => i !== index);
        const updatedSetlist = {
            ...setlist,
            [setKey]: updatedSet
        };

        setSetlist(updatedSetlist);
        notifyChange(updatedSetlist);
    };

    const handleMoveSong = (setKey, index, direction) => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= setlist[setKey].length) return;

        const updatedSet = [...setlist[setKey]];
        [updatedSet[index], updatedSet[newIndex]] = [updatedSet[newIndex], updatedSet[index]];

        const updatedSetlist = {
            ...setlist,
            [setKey]: updatedSet
        };

        setSetlist(updatedSetlist);
        notifyChange(updatedSetlist);
    };

    const handleUpdateSong = (setKey, index, field, value) => {
        const updatedSet = [...setlist[setKey]];

        // Special handling for jams_into checkbox
        if (field === 'jams_into') {
            if (value) {
                // When checked, set to the UUID of the next song in the setlist
                const nextSong = updatedSet[index + 1];
                updatedSet[index] = {
                    ...updatedSet[index],
                    [field]: nextSong ? nextSong.song_id : null
                };
            } else {
                // When unchecked, set to null
                updatedSet[index] = {
                    ...updatedSet[index],
                    [field]: null
                };
            }
        } else {
            updatedSet[index] = {
                ...updatedSet[index],
                [field]: value
            };
        }

        const updatedSetlist = {
            ...setlist,
            [setKey]: updatedSet
        };

        setSetlist(updatedSetlist);
        notifyChange(updatedSetlist);
    };

    const notifyChange = (updatedSetlist) => {
        if (onChange) {
            // Convert to API format
            // Only send junction table fields - song metadata comes from songs table
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
                        notes: song.notes || null,  // Performance-specific notes only
                        jams_into: song.jams_into || null  // UUID or null, NOT false
                    });
                });
            });

            onChange(apiFormat);
        }
    };

    const filteredSongs = allSongs.filter(song =>
        song.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const setLabels = {
        set1: 'Set 1',
        set2: 'Set 2',
        set3: 'Set 3',
        encore: 'Encore'
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-100">Setlist Editor</h3>
                <button
                    type="button"
                    onClick={() => setShowSongPicker(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    + Add Song
                </button>
            </div>

            {/* Song Picker Modal */}
            {showSongPicker && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xl font-bold text-gray-100">Add Song to {setLabels[selectedSet]}</h4>
                            <button
                                onClick={() => {
                                    setShowSongPicker(false);
                                    setSearchTerm('');
                                }}
                                className="text-gray-400 hover:text-gray-200 text-2xl transition-colors"
                            >
                                ×
                            </button>
                        </div>

                        {/* Set Selector */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Add to:
                            </label>
                            <select
                                value={selectedSet}
                                onChange={(e) => setSelectedSet(e.target.value)}
                                className="border border-gray-600 bg-gray-700 text-gray-100 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="set1">Set 1</option>
                                <option value="set2">Set 2</option>
                                <option value="set3">Set 3</option>
                                <option value="encore">Encore</option>
                            </select>
                        </div>

                        {/* Search */}
                        <input
                            type="text"
                            placeholder="Search songs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded px-4 py-2 mb-4 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />

                        {/* Song List */}
                        <div className="flex-1 overflow-y-auto border border-gray-700 rounded bg-gray-900">
                            {filteredSongs.map(song => (
                                <button
                                    key={song.id}
                                    onClick={() => handleAddSong(song)}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-800 border-b border-gray-700 last:border-b-0 transition-colors"
                                >
                                    <div className="font-medium text-gray-100">{song.title}</div>
                                    {song.original_artist && (
                                        <div className="text-sm text-gray-400">
                                            Cover of {song.original_artist}
                                        </div>
                                    )}
                                </button>
                            ))}
                            {filteredSongs.length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                    No songs found
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Setlist Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(setlist).map(([setKey, songs]) => (
                    <div key={setKey} className="border border-gray-700 rounded-lg p-4 bg-gray-900">
                        <h4 className="font-bold text-gray-100 mb-3">{setLabels[setKey]}</h4>

                        {songs.length === 0 ? (
                            <p className="text-gray-500 text-sm italic">No songs yet</p>
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
        <div className="border border-gray-700 rounded p-2 bg-gray-800">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <span className="text-gray-400 text-sm font-mono w-6">{index + 1}.</span>
                    <span className="font-medium text-gray-200">{song.title}</span>
                    {/* Show song metadata from songs table (read-only) */}
                    {song.is_original === true && (
                        <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded border border-green-700">
                            Original
                        </span>
                    )}
                    {song.is_original === false && (
                        <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-700">
                            Cover
                        </span>
                    )}
                    {song.jams_into && (
                        <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700 font-bold">
                            &gt;
                        </span>
                    )}
                </div>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-gray-400 hover:text-gray-200 px-2 transition-colors"
                        title="Edit details"
                    >
                        ⚙️
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove('up')}
                        disabled={isFirst}
                        className="text-gray-400 hover:text-gray-200 px-2 disabled:opacity-30 transition-colors"
                        title="Move up"
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove('down')}
                        disabled={isLast}
                        className="text-gray-400 hover:text-gray-200 px-2 disabled:opacity-30 transition-colors"
                        title="Move down"
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="text-red-400 hover:text-red-300 px-2 transition-colors"
                        title="Remove"
                    >
                        ×
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-2 pt-2 border-t border-gray-700 space-y-2">
                    {/* Song metadata from songs table (read-only display) */}
                    {song.original_artist && (
                        <div className="text-sm text-gray-400">
                            <span className="font-semibold">Original Artist:</span> {song.original_artist}
                        </div>
                    )}
                    {song.written_by && (
                        <div className="text-sm text-gray-400">
                            <span className="font-semibold">Written By:</span> {song.written_by}
                        </div>
                    )}

                    {/* Performance-specific fields (editable) */}
                    <div className="pt-2 border-t border-gray-600">
                        <label className="flex items-center text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={!!song.jams_into}
                                onChange={(e) => onUpdate('jams_into', e.target.checked)}
                                className="mr-2"
                            />
                            Jams into next song <span className="ml-1 text-purple-400 font-bold">&gt;</span>
                        </label>

                        <input
                            type="text"
                            placeholder="Performance notes (e.g., 'with guest', 'teases')"
                            value={song.notes || ''}
                            onChange={(e) => onUpdate('notes', e.target.value)}
                            className="mt-2 border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Help text */}
                    <div className="text-xs text-gray-500 italic pt-2 border-t border-gray-600">
                        💡 To change song metadata (original/cover, artist, writer), edit the song in the Songs admin panel.
                    </div>
                </div>
            )}
        </div>
    );
}

