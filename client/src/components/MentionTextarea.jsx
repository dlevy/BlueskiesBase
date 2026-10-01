import { useState, useRef } from 'react';

// Finds the @token currently being typed, ending at the cursor — must start
// at a word boundary (start of text, or preceded by whitespace) and contain
// no whitespace of its own. Returns null if the cursor isn't inside one.
function detectMention(text, cursor) {
    const upToCursor = text.slice(0, cursor);
    const at = upToCursor.lastIndexOf('@');
    if (at === -1) return null;
    const between = upToCursor.slice(at + 1);
    if (/\s/.test(between)) return null;
    const beforeAt = upToCursor[at - 1];
    if (beforeAt && !/\s/.test(beforeAt)) return null;
    return { start: at, query: between };
}

/**
 * A plain <textarea> with @mention autocomplete layered on top. The dropdown
 * appears below the textarea (not pixel-anchored to the caret — simpler than
 * measuring caret position, same placement style QuickAddSong.jsx already
 * uses for its own dropdown), filtered against both username and display
 * name as you type, matching up to 6 members.
 */
export default function MentionTextarea({ value, onChange, members = [], placeholder, rows = 4, className }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlighted, setHighlighted] = useState(0);
    const [mentionStart, setMentionStart] = useState(null);
    const textareaRef = useRef(null);

    const q = query.toLowerCase();
    const matches = open && q
        ? members
            .filter(m => (m.username || '').toLowerCase().includes(q) || (m.displayName || '').toLowerCase().includes(q))
            .slice(0, 6)
        : [];

    const handleChange = (e) => {
        const text = e.target.value;
        const cursor = e.target.selectionStart;
        onChange(text);

        const mention = detectMention(text, cursor);
        if (mention) {
            setOpen(true);
            setQuery(mention.query);
            setMentionStart(mention.start);
            setHighlighted(0);
        } else {
            setOpen(false);
        }
    };

    const selectMember = (member) => {
        const textarea = textareaRef.current;
        const cursor = textarea ? textarea.selectionStart : value.length;
        const before = value.slice(0, mentionStart);
        const after = value.slice(cursor);
        const inserted = `@${member.username} `;
        const newText = before + inserted + after;
        onChange(newText);
        setOpen(false);

        requestAnimationFrame(() => {
            if (!textarea) return;
            const pos = before.length + inserted.length;
            textarea.focus();
            textarea.setSelectionRange(pos, pos);
        });
    };

    const handleKeyDown = (e) => {
        if (!open || matches.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted(h => Math.min(h + 1, matches.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            selectMember(matches[highlighted]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={placeholder}
                className={className}
                rows={rows}
            />

            {open && matches.length > 0 && (
                <div
                    className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-white/10 overflow-hidden shadow-xl max-h-56 overflow-y-auto"
                    style={{ background: 'var(--p-color-canvas)' }}
                >
                    {matches.map((m, i) => (
                        <button
                            type="button"
                            key={m.id}
                            onMouseDown={e => e.preventDefault()}
                            onMouseEnter={() => setHighlighted(i)}
                            onClick={() => selectMember(m)}
                            className="w-full text-left px-3 py-2 text-sm border-b border-white/5 last:border-b-0 transition-colors"
                            style={{ background: i === highlighted ? 'color-mix(in srgb, var(--p-color-notification-warning) 15%, transparent)' : 'transparent' }}
                        >
                            <span style={{ color: 'var(--p-color-primary)' }}>@{m.username}</span>
                            {m.displayName && (
                                <span className="ml-2 text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>{m.displayName}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
