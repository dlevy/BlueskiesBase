import { useState, useEffect, useCallback } from 'react';
import { PHeading, PText, PButton } from '@porsche-design-system/components-react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getSongs } from '../services/api';
import QuickAddSong from './QuickAddSong';

// soundcheck sorts first so it renders above Set 1 when active, matching
// the public show page's "Sound Check" section sitting above the Setlist.
const PERFORMANCE_TYPES = [
    { value: 'full', label: 'Full' },
    { value: 'tease', label: 'Tease' },
    { value: 'partial', label: 'Partial' },
    { value: 'dj', label: "DJ'd" },
];

const SET_ORDER = ['soundcheck', 'set1', 'set2', 'set3', 'encore'];
const SET_LABELS = { soundcheck: 'Sound Check', set1: 'Set 1', set2: 'Set 2', set3: 'Set 3', encore: 'Encore' };
const EMPTY_SETLIST = { soundcheck: [], set1: [], set2: [], set3: [], encore: [] };

export default function SetlistEditor({ initialSetlist = {}, onChange }) {
    const [setlist, setSetlist] = useState(EMPTY_SETLIST);
    // Which set sections are shown. Always includes set1 — everything else (soundcheck,
    // set2, set3, encore) only appears once it holds songs (loaded from an existing show)
    // or the admin explicitly adds it, so a typical single-set show doesn't render extra
    // empty boxes.
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
                const isSoundcheck = setKey === 'soundcheck';
                // set_number=0 is a sentinel for soundcheck rows — set_number is NOT NULL
                // in the DB but otherwise meaningless there, since performance_type is the
                // authoritative "what kind of row is this" signal (same relationship 'dj'
                // already has to a real set — the difference is soundcheck gets its own
                // section instead of living inline within one).
                const setNumber = isSoundcheck ? 0 : (setKey === 'encore' ? 1 : parseInt(setKey.replace('set', '')));
                const isEncore = setKey === 'encore';
                songs.forEach((song, index) => {
                    apiFormat.push({
                        song_id: song.song_id,
                        set_number: setNumber,
                        song_order: index + 1,
                        is_encore: isEncore,
                        // Strip blank entries (e.g. an added-then-left-empty row) before
                        // saving — never persist an empty-string note.
                        notes: (song.notes || []).map(n => n.trim()).filter(Boolean),
                        jams_into: song.jams_into || null,
                        // Soundcheck isn't independently editable to tease/partial/dj —
                        // those classify a live performance, which this isn't.
                        performance_type: isSoundcheck ? 'soundcheck' : (song.performance_type || 'full')
                    });
                });
            });
            onChange(apiFormat);
        }
    }, [onChange]);

    const convertInitialSetlist = useCallback((initial) => {
        const converted = { soundcheck: [], set1: [], set2: [], set3: [], encore: [] };
        Object.entries(initial).forEach(([setKey, songs]) => {
            if (songs && Array.isArray(songs)) {
                converted[setKey] = songs.map((song, index) => ({
                    id: song.id,
                    song_id: song.song_id || song.songs?.id,
                    title: song.title || song.songs?.title,
                    is_original: song.is_original ?? null,
                    is_sunday_valley: song.is_sunday_valley ?? false,
                    original_artist: song.original_artist || null,
                    // notes is an array of strings (setlist_songs.notes is a TEXT[] column) —
                    // defensive conversion in case anything upstream ever hands back the old
                    // single-string shape.
                    notes: Array.isArray(song.notes) ? song.notes : (song.notes ? [song.notes] : []),
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

    // Drag-and-drop needs a genuinely unique id per row to track items, not just a
    // React key — Date.now() alone could collide if two songs land in the same
    // millisecond (e.g. two quick picks from the keyboard, or the two rows a
    // single "middle" insert below adds at once).
    const newRowId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // `song` is catalog-shaped ({id, title, is_original, is_sunday_valley,
    // original_artist, written_by}, as QuickAddSong hands back) — note `id`
    // there is the SONG's id, unlike a setlist row object where that same
    // thing lives in `song_id`.
    const buildEntry = (song, performanceType) => ({
        id: newRowId(),
        song_id: song.id,
        title: song.title,
        is_original: song.is_original,
        is_sunday_valley: song.is_sunday_valley,
        original_artist: song.original_artist,
        written_by: song.written_by,
        notes: [],
        jams_into: null,
        performance_type: performanceType,
    });

    // Appends to the bottom of a set — the "type and press Enter" quick-add's
    // only job, always performanceType 'full'.
    const insertSong = (setKey, atIndex, song, performanceType = 'full') => {
        const updatedSet = [...setlist[setKey]];
        updatedSet.splice(atIndex, 0, { ...buildEntry(song, performanceType), order: atIndex });
        const updatedSetlist = { ...setlist, [setKey]: updatedSet };
        setSetlist(updatedSetlist);
        notifyChange(updatedSetlist);
    };

    // Handles the per-song "+ Add Tease"/"+ Add Partial" buttons, which also
    // ask where relative to the anchor song (the row the button was clicked
    // on) it happened:
    //   - 'beginning' — inserted right before the anchor.
    //   - 'end' (default) — inserted right after the anchor — the original
    //     behavior from before position existed.
    //   - 'middle' — the anchor song is resumed afterward (e.g. a tease
    //     played mid-song, then the song continues), so this brings the
    //     anchor song itself back in automatically right after the inserted
    //     row instead of making the admin search for and re-add the same
    //     song a second time — chained via jams_into on both transitional
    //     rows (the same mechanism the connector between rows already sets)
    //     so the resumed anchor is recognized as a continuation, not
    //     renumbered as a second, separate instance of that song (see
    //     assignSetlistDisplayNumbers in utils/setlist.js).
    const insertPerformance = (setKey, anchorIndex, song, performanceType, position) => {
        const anchor = setlist[setKey][anchorIndex];
        const updatedSet = [...setlist[setKey]];

        if (position === 'beginning') {
            updatedSet.splice(anchorIndex, 0, buildEntry(song, performanceType));
        } else if (position === 'middle') {
            const anchorAsSong = {
                id: anchor.song_id, title: anchor.title, is_original: anchor.is_original,
                is_sunday_valley: anchor.is_sunday_valley, original_artist: anchor.original_artist, written_by: anchor.written_by,
            };
            const teaseEntry = { ...buildEntry(song, performanceType), jams_into: anchor.song_id };
            const continuationEntry = buildEntry(anchorAsSong, anchor.performance_type || 'full');
            updatedSet[anchorIndex] = { ...anchor, jams_into: song.id };
            updatedSet.splice(anchorIndex + 1, 0, teaseEntry, continuationEntry);
        } else {
            updatedSet.splice(anchorIndex + 1, 0, buildEntry(song, performanceType));
        }

        const updatedSetlist = { ...setlist, [setKey]: updatedSet };
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

    // Drag-and-drop reordering within a set — dropping a song onto another one's position
    // moves it there directly, instead of clicking ↑/↓ repeatedly. Especially handy right
    // after merging a batch of community-submitted songs, which land at the end of a set
    // and often need to move into their actual chronological spot.
    const handleDragEnd = (setKey, event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const songs = setlist[setKey];
        const oldIndex = songs.findIndex(s => s.id === active.id);
        const newIndex = songs.findIndex(s => s.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const updatedSetlist = { ...setlist, [setKey]: arrayMove(songs, oldIndex, newIndex) };
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
    const soundcheckActive = activeSets.includes('soundcheck');

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
                        isSoundcheck={setKey === 'soundcheck'}
                        onAddSong={(song) => insertSong(setKey, setlist[setKey].length, song)}
                        onInsertSong={(anchorIndex, song, performanceType, position) => insertPerformance(setKey, anchorIndex, song, performanceType, position)}
                        onSongCreated={handleSongCreated}
                        onRemoveSong={(index) => handleRemoveSong(setKey, index)}
                        onUpdateSong={(index, field, value) => handleUpdateSong(setKey, index, field, value)}
                        onDragEnd={(event) => handleDragEnd(setKey, event)}
                        onRemoveSet={setKey !== 'set1' && setlist[setKey].length === 0 ? () => removeSetSection(setKey) : null}
                    />
                ))}
            </div>

            {(nextNumberedSet || !encoreActive || !soundcheckActive) && (
                <div className="flex gap-2">
                    {!soundcheckActive && (
                        <PButton type="button" variant="secondary" size="small" onClick={() => addSetSection('soundcheck')}>
                            + Add Sound Check
                        </PButton>
                    )}
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

function SetSection({ label, songs, allSongs, isSoundcheck, onAddSong, onInsertSong, onSongCreated, onRemoveSong, onUpdateSong, onDragEnd, onRemoveSet }) {
    // A small activation distance keeps a plain click on the ⚙/×/drag-handle buttons from
    // being mistaken for a drag; KeyboardSensor gives the drag handle the standard dnd-kit
    // keyboard flow (Tab to it, Space to pick up, arrow keys to move, Space to drop).
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

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
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2 mb-3">
                            {songs.map((song, index) => (
                                <div key={song.id ?? index}>
                                    <SetlistSongItem
                                        song={song}
                                        index={index}
                                        isSoundcheck={isSoundcheck}
                                        allSongs={allSongs}
                                        onSongCreated={onSongCreated}
                                        onInsertSong={onInsertSong}
                                        onRemove={() => onRemoveSong(index)}
                                        onUpdate={(field, value) => onUpdateSong(index, field, value)}
                                    />
                                    {/* Not part of the sortable list (no useSortable/id in `items`) —
                                        dnd-kit only tracks drag state for registered items, so this
                                        plain button sits between rows unaffected by drag sensors. */}
                                    {index < songs.length - 1 && (
                                        <JamConnector
                                            linked={!!song.jams_into}
                                            onToggle={() => onUpdateSong(index, 'jams_into', !song.jams_into)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            <QuickAddSong allSongs={allSongs} onAddSong={onAddSong} onSongCreated={onSongCreated} />
        </div>
    );
}

// Sits between two consecutive songs — a faster way to set jams_into than
// opening a song's ⚙ settings panel and finding the checkbox there. Toggles
// the exact same field via the same onUpdate path the checkbox already uses,
// so the two controls can never drift out of sync with each other. Uses the
// same ">" glyph the row's own jams_into chip and the settings panel's
// checkbox label already use for this, rather than a separate icon, so
// there's only one visual symbol for "jams into" on this whole page.
function JamConnector({ linked, onToggle }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-center my-1 group"
            title={linked ? 'Jams into next song — click to remove' : 'Click to mark as jamming into the next song'}
            aria-pressed={linked}
            aria-label={linked ? 'Jams into next song' : 'Does not jam into next song'}
        >
            <span className={`ml-2 flex items-center justify-center w-6 h-6 rounded-full border shrink-0 font-bold text-sm transition-colors ${
                linked
                    ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                    : 'border-white/15 text-[var(--p-color-contrast-low)] group-hover:border-white/30 group-hover:text-[var(--p-color-contrast-medium)]'
            }`}>
                &gt;
            </span>
            <span className={`h-px flex-1 ml-2 transition-colors ${linked ? 'bg-amber-400/50' : 'bg-white/10 group-hover:bg-white/25'}`} />
        </button>
    );
}

const INSERT_POSITIONS = [
    { value: 'beginning', label: 'Beginning' },
    { value: 'middle', label: 'Middle' },
    { value: 'end', label: 'End' },
];

function SetlistSongItem({ song, index, isSoundcheck, allSongs, onSongCreated, onInsertSong, onRemove, onUpdate }) {
    const [isExpanded, setIsExpanded] = useState(false);
    // null | 'tease' | 'partial' — which inline "insert a song relative to
    // this one" picker is open, if any. Lets a tease/partial be added at the
    // exact spot it belongs instead of at the bottom of the set and then
    // dragged into place.
    const [inserting, setInserting] = useState(null);
    // Where the tease/partial happened relative to this song — 'end' (right
    // after, flowing into whatever comes next) is the default since it's
    // the simplest, most common case. Reset to 'end' each time a fresh
    // insert flow opens so it never carries over from a previous one.
    const [insertPosition, setInsertPosition] = useState('end');
    const openInsert = (type) => { setInserting(type); setInsertPosition('end'); };
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id });

    // Always shows at least one (empty) input, even for a song with zero
    // notes saved — "default it to one" per the editor's own UX, while the
    // underlying array stays empty until something is actually typed
    // (notifyChange strips blank entries before saving either way).
    const notesList = song.notes?.length > 0 ? song.notes : [''];
    const updateNote = (i, value) => {
        const updated = [...notesList];
        updated[i] = value;
        onUpdate('notes', updated);
    };
    const removeNote = (i) => onUpdate('notes', notesList.filter((_, idx) => idx !== i));
    const addNote = () => onUpdate('notes', [...notesList, '']);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={{ ...style, background: 'var(--p-color-canvas)' }} className="rounded-lg border border-white/10 p-2">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                    <button type="button" {...attributes} {...listeners}
                        className="px-1 py-0.5 rounded hover:bg-white/10 transition-colors shrink-0 touch-none"
                        style={{ color: 'var(--p-color-contrast-medium)', cursor: isDragging ? 'grabbing' : 'grab' }}
                        title="Drag to reorder"
                        aria-label="Drag to reorder">
                        <svg aria-hidden="true" width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                            <circle cx="2" cy="2" r="1.4" /><circle cx="8" cy="2" r="1.4" />
                            <circle cx="2" cy="7" r="1.4" /><circle cx="8" cy="7" r="1.4" />
                            <circle cx="2" cy="12" r="1.4" /><circle cx="8" cy="12" r="1.4" />
                        </svg>
                    </button>
                    <button type="button" onClick={() => setIsExpanded(!isExpanded)}
                        className="px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-xs shrink-0"
                        style={{ color: 'var(--p-color-contrast-medium)' }} title="Edit details">
                        ⚙
                    </button>
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
                    {song.is_sunday_valley && (
                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded border"
                            style={{ color: '#2dd4bf', borderColor: '#2dd4bf', background: 'color-mix(in srgb, #2dd4bf 10%, transparent)' }}>
                            Sunday Valley
                        </span>
                    )}
                    {song.jams_into && (
                        <span className="shrink-0 text-xs px-1 py-0.5 rounded font-bold"
                            style={{ color: 'var(--p-color-primary)', borderColor: 'currentColor', border: '1px solid' }}>
                            &gt;
                        </span>
                    )}
                    {/* Meaningless for a soundcheck song — tease/partial/dj all classify
                        a live performance, which this isn't; its performance_type is
                        always forced to 'soundcheck' on save. */}
                    {!isSoundcheck && (
                        <div className="flex items-center gap-2 shrink-0">
                            {PERFORMANCE_TYPES.map(opt => (
                                <label key={opt.value} className="flex items-center gap-1 text-xs cursor-pointer"
                                    style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    <input type="radio" name={`performance-type-${song.id ?? index}`} value={opt.value}
                                        checked={(song.performance_type || 'full') === opt.value}
                                        onChange={() => onUpdate('performance_type', opt.value)}
                                        className="w-3 h-3" />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={onRemove}
                        className="px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-sm"
                        style={{ color: 'var(--p-color-error)' }} title="Remove">
                        ×
                    </button>
                </div>
            </div>

            {/* Meaningless for a soundcheck song, same reasoning as the Performance
                Type radios above. */}
            {!isSoundcheck && (
                inserting ? (
                    <div className="mt-1.5 pl-1 space-y-1">
                        <div className="flex items-center gap-1">
                            {INSERT_POSITIONS.map(opt => (
                                <button key={opt.value} type="button" onClick={() => setInsertPosition(opt.value)}
                                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                        insertPosition === opt.value
                                            ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                                            : 'border-white/15 hover:border-white/30'
                                    }`}
                                    style={insertPosition !== opt.value ? { color: 'var(--p-color-contrast-low)' } : undefined}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-start gap-1">
                            <div className="flex-1 min-w-0">
                                <QuickAddSong
                                    allSongs={allSongs}
                                    onSongCreated={onSongCreated}
                                    onAddSong={(pickedSong) => { onInsertSong(index, pickedSong, inserting, insertPosition); setInserting(null); }}
                                    placeholder={
                                        insertPosition === 'beginning' ? `Type a song that was ${inserting === 'tease' ? 'teased' : 'played'} before this one…`
                                        : insertPosition === 'middle' ? `Type a song that was ${inserting === 'tease' ? 'teased' : 'played'} in the middle of this one — it'll come back in after…`
                                        : `Type a song to add as a ${inserting} right after this one…`
                                    }
                                />
                            </div>
                            <button type="button" onClick={() => setInserting(null)}
                                className="px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-sm shrink-0"
                                style={{ color: 'var(--p-color-contrast-medium)' }} title="Cancel">
                                ×
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-1 pl-1 flex gap-3">
                        <button type="button" onClick={() => openInsert('tease')}
                            className="text-xs hover:underline" style={{ color: 'var(--p-color-contrast-low)' }}>
                            + Add Tease
                        </button>
                        <button type="button" onClick={() => openInsert('partial')}
                            className="text-xs hover:underline" style={{ color: 'var(--p-color-contrast-low)' }}>
                            + Add Partial
                        </button>
                    </div>
                )
            )}

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
                        <div className="space-y-1">
                            {notesList.map((note, i) => (
                                <div key={i} className="flex gap-1">
                                    <input type="text" placeholder="Performance notes (e.g., 'with guest', 'acoustic version')"
                                        value={note} onChange={e => updateNote(i, e.target.value)}
                                        className="flex-1 min-w-0 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--p-color-info)] placeholder:text-gray-500" />
                                    {notesList.length > 1 && (
                                        <button type="button" onClick={() => removeNote(i)}
                                            className="px-1.5 rounded hover:bg-white/10 transition-colors text-sm shrink-0"
                                            style={{ color: 'var(--p-color-error)' }} title="Remove note">
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button type="button" onClick={addNote}
                                className="text-xs hover:underline" style={{ color: 'var(--p-color-info)' }}>
                                + Add note
                            </button>
                            {/* Tease/partial are classified via Performance Type above, not
                                here — notes are free-text context, never a substitute for that. */}
                            <PText size="x-small" style={{ color: 'var(--p-color-contrast-low)' }} className="block">
                                Context only — don't use this to mark a tease or partial, use Performance Type above for that.
                            </PText>
                        </div>
                    </div>

                    <PText size="x-small" style={{ color: 'var(--p-color-contrast-low)' }} className="pt-1 border-t border-white/10">
                        To change song metadata, edit the song in the Songs admin panel.
                    </PText>
                </div>
            )}
        </div>
    );
}
