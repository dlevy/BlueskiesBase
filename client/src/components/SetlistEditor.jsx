import { useState, useEffect, useCallback, useRef } from 'react';
import { PHeading, PText, PButton } from '@porsche-design-system/components-react';
import { getSongs, createSong } from '../services/api';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

const SET_ORDER = ['set1', 'set2', 'set3', 'encore'];
const SET_LABELS = { set1: 'Set 1', set2: 'Set 2', set3: 'Set 3', encore: 'Encore' };
const EMPTY_SETLIST = { set1: [], set2: [], set3: [], encore: [] };

export default function SetlistEditor({ initialSetlist = {}, onChange }) {
    const [setlist, setSetlist] = useState(EMPTY_SETLIST);
    // Which set sections are shown. Always includes set1 — everything else (set2, set3,
    // encore) only appears once it holds songs (loaded from an existing show) or the admin
    // explicitly adds it, so a typical single-set show doesn't render three empty boxes.
    const [activeSets, setActiveSets] = useState(['set1']);
    const [allSongs, setAllSongs] = useState([]);

    const fetchSongs = useCallback(async () => {
        try {
            const data = await getSongs();
            setAllSongs(data.songs || []);
        } catch (err) {
            console.error('Error fetching songs:', err);
        }
    }, []);

    // Defined before convertInitialSetlist (and wrapped in useCallback keyed only on
    // `onChange`) so that hydrating from an existing setlist below can call it directly
    // with a stable reference, instead of risking a stale closure over a later redefinition.
    const notifyChange = useCallback((updatedSetlist) => {
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
    }, [onChange]);

    const convertInitialSetlist = useCallback((initial) => {
        const converted = { set1: [], set2: [], set3: [], encore: [] };
        Object.entries(initial).forEach(([setKey, songs]) => {
            if (songs && Array.isArray(songs)) {
                converted[setKey] = songs.map((song, index) => ({
                    id: song.id,
                    song_id: song.song_id || song.songs?.id,
                    title: song.title || song.songs?.title,
                    is_original: song.is_original ?? null,
                    original_artist: song.original_artist || null,
                    notes: song.notes || '',
                    jams_into: song.jams_into || null,
                    performance_type: song.performance_type || 'full',
                    order: index
                }));
            }
        });
        setSetlist(converted);
        // Reveal any section that already has songs (e.g. an existing show with an encore),
        // in addition to set1 which is always shown.
        setActiveSets(SET_ORDER.filter(k => k === 'set1' || converted[k].length > 0));
        // Lift the hydrated setlist up to the parent (ShowForm) immediately. Without this,
        // the parent's "current setlist to save" state stays empty until the admin manually
        // edits a song, so saving the show after changing an unrelated field (e.g. notes)
        // would submit an empty setlist and wipe every song — see git history for the bug
        // this fixed.
        notifyChange(converted);
    }, [notifyChange]);

    useEffect(() => { fetchSongs(); }, [fetchSongs]);
    // Always convert — even an empty initialSetlist ({} for a show with no setlist yet)
    // still needs to run through convertInitialSetlist so notifyChange fires and the
    // parent learns hydration has happened. Skipping the call when there's nothing to
    // convert is what let ShowForm's setlistData silently stay unpopulated before a save.
    useEffect(() => {
        convertInitialSetlist(initialSetlist || {});
    }, [initialSetlist, convertInitialSetlist]);

    const handleAddSong = (setKey, song) => {
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
            order: setlist[setKey].length
        };
        const updatedSetlist = { ...setlist, [setKey]: [...setlist[setKey], newSong] };
        setSetlist(updatedSetlist);
        notifyChange(updatedSetlist);
    };

    // A song just created via the "+ Add ... as a new song" quick-add option — merge it into
    // the catalog so it's searchable immediately (e.g. if it comes up again later in the same
    // setlist) without waiting on a refetch.
    const handleSongCreated = (song) => {
        setAllSongs(prev => [...prev, song].sort((a, b) => a.title.localeCompare(b.title)));
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

    const addSetSection = (setKey) => {
        setActiveSets(prev => SET_ORDER.filter(k => prev.includes(k) || k === setKey));
    };

    const removeSetSection = (setKey) => {
        if (setKey === 'set1' || setlist[setKey].length > 0) return; // set1 is permanent; never drop a section with songs
        setActiveSets(prev => prev.filter(k => k !== setKey));
    };

    const nextNumberedSet = ['set2', 'set3'].find(k => !activeSets.includes(k));
    const encoreActive = activeSets.includes('encore');

    return (
        <div className="space-y-4">
            <PHeading size="lg" tag="h3">Setlist Editor</PHeading>

            <div className="space-y-4">
                {SET_ORDER.filter(k => activeSets.includes(k)).map(setKey => (
                    <SetSection
                        key={setKey}
                        label={SET_LABELS[setKey]}
                        songs={setlist[setKey]}
                        allSongs={allSongs}
                        onAddSong={(song) => handleAddSong(setKey, song)}
                        onSongCreated={handleSongCreated}
                        onRemoveSong={(index) => handleRemoveSong(setKey, index)}
                        onMoveSong={(index, direction) => handleMoveSong(setKey, index, direction)}
                        onUpdateSong={(index, field, value) => handleUpdateSong(setKey, index, field, value)}
                        onRemoveSet={setKey !== 'set1' && setlist[setKey].length === 0 ? () => removeSetSection(setKey) : null}
                    />
                ))}
            </div>

            {(nextNumberedSet || !encoreActive) && (
                <div className="flex gap-2">
                    {nextNumberedSet && (
                        <PButton type="button" variant="secondary" size="small" onClick={() => addSetSection(nextNumberedSet)}>
                            + Add {SET_LABELS[nextNumberedSet]}
                        </PButton>
                    )}
                    {!encoreActive && (
                        <PButton type="button" variant="secondary" size="small" onClick={() => addSetSection('encore')}>
                            + Add Encore
                        </PButton>
                    )}
                </div>
            )}
        </div>
    );
}

function SetSection({ label, songs, allSongs, onAddSong, onSongCreated, onRemoveSong, onMoveSong, onUpdateSong, onRemoveSet }) {
    return (
        <div className="rounded-xl border border-white/10 p-4" style={{ background: 'var(--p-color-surface)' }}>
            <div className="flex items-center justify-between mb-3">
                <PHeading size="sm" tag="h4">{label}</PHeading>
                {onRemoveSet && (
                    <button type="button" onClick={onRemoveSet}
                        className="text-xs px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
                        style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Remove
                    </button>
                )}
            </div>

            {songs.length > 0 && (
                <div className="space-y-2 mb-3">
                    {songs.map((song, index) => (
                        <SetlistSongItem
                            key={song.id ?? index}
                            song={song}
                            index={index}
                            isFirst={index === 0}
                            isLast={index === songs.length - 1}
                            onRemove={() => onRemoveSong(index)}
                            onMove={(direction) => onMoveSong(index, direction)}
                            onUpdate={(field, value) => onUpdateSong(index, field, value)}
                        />
                    ))}
                </div>
            )}

            <QuickAddSong allSongs={allSongs} onAddSong={onAddSong} onSongCreated={onSongCreated} />
        </div>
    );
}

/**
 * Inline "type and press Enter" song entry. Replaces the old Add Song button + full-screen
 * modal: matches are filtered from the already-fetched song catalog as you type, Enter adds
 * the highlighted match, and the input clears and stays focused so the next title can be
 * typed immediately — no click between songs. Typing something with no existing match offers
 * "+ Add '<title>' as a new song", which creates it via the API and adds it in the same step,
 * so a brand-new cover doesn't require a trip to the Songs admin panel to keep entry moving.
 */
function QuickAddSong({ allSongs, onAddSong, onSongCreated }) {
    const [query, setQuery] = useState('');
    const [highlighted, setHighlighted] = useState(0);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    const q = query.trim().toLowerCase();
    const matches = q
        ? allSongs
            .filter(s => s.title.toLowerCase().includes(q))
            .sort((a, b) => {
                const aStarts = a.title.toLowerCase().startsWith(q) ? 0 : 1;
                const bStarts = b.title.toLowerCase().startsWith(q) ? 0 : 1;
                return aStarts - bStarts || a.title.localeCompare(b.title);
            })
            .slice(0, 8)
        : [];

    const exactMatch = matches.some(s => s.title.toLowerCase() === q);
    const showCreateOption = q.length > 0 && !exactMatch;
    const optionCount = matches.length + (showCreateOption ? 1 : 0);
    const isOpen = optionCount > 0;

    useEffect(() => { setHighlighted(0); }, [query]);

    const reset = () => {
        setQuery('');
        setHighlighted(0);
        setError('');
        inputRef.current?.focus();
    };

    const selectExisting = (song) => {
        onAddSong(song);
        reset();
    };

    const selectCreateNew = async () => {
        const title = query.trim();
        if (!title || creating) return;
        setCreating(true);
        setError('');
        try {
            const newSong = await createSong({ title });
            onSongCreated(newSong);
            onAddSong(newSong);
            reset();
        } catch (err) {
            setError(err.message || 'Failed to create song');
        } finally {
            setCreating(false);
        }
    };

    const selectHighlighted = () => {
        if (highlighted < matches.length) selectExisting(matches[highlighted]);
        else if (showCreateOption) selectCreateNew();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            if (!isOpen) return;
            e.preventDefault();
            setHighlighted(h => Math.min(h + 1, optionCount - 1));
        } else if (e.key === 'ArrowUp') {
            if (!isOpen) return;
            e.preventDefault();
            setHighlighted(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            if (!isOpen) return;
            e.preventDefault();
            selectHighlighted();
        } else if (e.key === 'Escape') {
            setQuery('');
            setError('');
        }
    };

    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                value={query}
                disabled={creating}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a song title, press Enter to add…"
                autoComplete="off"
                className={inputClass}
            />

            {isOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 overflow-hidden shadow-xl max-h-72 overflow-y-auto"
                    style={{ background: 'var(--p-color-canvas)' }}>
                    {matches.map((song, i) => (
                        <button type="button" key={song.id}
                            onMouseDown={e => e.preventDefault()}
                            onMouseEnter={() => setHighlighted(i)}
                            onClick={() => selectExisting(song)}
                            className="w-full text-left px-3 py-2 text-sm border-b border-white/5 last:border-b-0 transition-colors"
                            style={{ background: i === highlighted ? 'color-mix(in srgb, var(--p-color-notification-warning) 15%, transparent)' : 'transparent' }}>
                            <span style={{ color: 'var(--p-color-primary)' }}>{song.title}</span>
                            {song.original_artist && (
                                <span className="ml-2 text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    Cover of {song.original_artist}
                                </span>
                            )}
                        </button>
                    ))}
                    {showCreateOption && (
                        <button type="button"
                            onMouseDown={e => e.preventDefault()}
                            onMouseEnter={() => setHighlighted(matches.length)}
                            onClick={selectCreateNew}
                            disabled={creating}
                            className="w-full text-left px-3 py-2 text-sm transition-colors disabled:opacity-50"
                            style={{
                                color: 'var(--p-color-info)',
                                background: highlighted === matches.length ? 'color-mix(in srgb, var(--p-color-info) 12%, transparent)' : 'transparent'
                            }}>
                            {creating ? 'Adding…' : `+ Add "${query.trim()}" as a new song`}
                        </button>
                    )}
                </div>
            )}

            {error && (
                <PText size="x-small" style={{ color: 'var(--p-color-error)' }} className="mt-1">
                    {error}
                </PText>
            )}
        </div>
    );
}

function SetlistSongItem({ song, index, isFirst, isLast, onRemove, onMove, onUpdate }) {
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
