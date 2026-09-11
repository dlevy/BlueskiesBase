import { useState, useEffect, useRef } from 'react';
import { PText } from '@porsche-design-system/components-react';
import { createSong } from '../services/api';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

/**
 * Inline "type and press Enter" song entry, shared by the admin SetlistEditor and the
 * public community setlist submission form. Matches are filtered from the already-fetched
 * song catalog as you type, Enter adds the highlighted match, and the input clears and stays
 * focused so the next title can be typed immediately — no click between songs.
 *
 * allowCreate controls whether typing something with no existing match offers
 * "+ Add '<title>' as a new song" (creates it via the API and adds it in the same step).
 * The admin editor allows this — a brand-new cover shouldn't require a trip to the Songs
 * admin panel to keep entry moving. The public submission form does NOT: unlike a
 * submission itself (isolated in its own table until an admin merges it), a newly created
 * song lands directly and immediately in the shared songs catalog used everywhere else on
 * the site (search filters, the admin picker), so minting one isn't something to hand to
 * every logged-in visitor. A fan who can't find a song can describe it in the submission's
 * free-text note instead.
 */
export default function QuickAddSong({ allSongs, onAddSong, onSongCreated, allowCreate = true, placeholder = 'Type a song title, press Enter to add…' }) {
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
    const showCreateOption = allowCreate && q.length > 0 && !exactMatch;
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
            onSongCreated?.(newSong);
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
                placeholder={placeholder}
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
