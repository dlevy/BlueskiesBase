import { useRef, useState } from 'react';
import MentionTextarea from './MentionTextarea';
import ShowLinkPicker from './ShowLinkPicker';

const toolBtn = "inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold border border-white/10 hover:border-white/25 hover:bg-white/5 transition-all";
const actionBtn = "inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border border-white/10 hover:border-white/25 hover:bg-white/5 transition-all";

/**
 * MentionTextarea plus a lightweight formatting toolbar for forum thread/
 * reply bodies (not used by CommentsSection's show notes — this is forum-
 * composition-specific). Bold/Italic/Strike wrap the current selection in
 * markdown-style markers (double-star, underscore, double-tilde) that PostBody's
 * renderForumMarkup turns back into actual styled text when viewed; this isn't a live
 * WYSIWYG (you see the markers while typing, not the styling), which keeps
 * the body a plain string — @mentions, quoting, search snippets, and the
 * edited indicator all keep working exactly as before. Setlist Link/Insert
 * Setlist open a show picker and insert a [label](/show/...) link or a
 * formatted setlist block at the cursor.
 */
export default function ForumPostEditor({ value, onChange, members, placeholder, rows = 4, className }) {
    const textareaRef = useRef(null);
    const [picker, setPicker] = useState(null); // null | 'link' | 'setlist'

    const applyWrap = (marker) => {
        const el = textareaRef.current;
        const start = el ? el.selectionStart : value.length;
        const end = el ? el.selectionEnd : value.length;
        const hadSelection = end > start;
        const selected = hadSelection ? value.slice(start, end) : 'text';
        const before = value.slice(0, start);
        const after = value.slice(end);
        const newValue = `${before}${marker}${selected}${marker}${after}`;
        onChange(newValue);

        requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            el.setSelectionRange(start + marker.length, start + marker.length + selected.length);
        });
    };

    const insertAtCursor = (text) => {
        const el = textareaRef.current;
        const pos = el ? el.selectionStart : value.length;
        const needsLeadingSpace = pos > 0 && !/\s$/.test(value.slice(0, pos));
        const insertion = (needsLeadingSpace ? ' ' : '') + text;
        const newValue = value.slice(0, pos) + insertion + value.slice(pos);
        onChange(newValue);

        requestAnimationFrame(() => {
            if (!el) return;
            const cursor = pos + insertion.length;
            el.focus();
            el.setSelectionRange(cursor, cursor);
        });
    };

    return (
        <div>
            <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => applyWrap('**')} title="Bold" className={toolBtn}>B</button>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => applyWrap('_')} title="Italic" className={toolBtn + ' italic'}>I</button>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => applyWrap('~~')} title="Strikethrough" className={toolBtn + ' line-through'}>S</button>
                <span className="w-px h-4 mx-1" style={{ background: 'var(--p-color-contrast-low)', opacity: 0.3 }} />
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setPicker('link')} className={actionBtn}>Setlist Link</button>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setPicker('setlist')} className={actionBtn}>Insert Setlist</button>
            </div>

            <MentionTextarea
                ref={textareaRef}
                value={value}
                onChange={onChange}
                members={members}
                placeholder={placeholder}
                rows={rows}
                className={className}
            />

            {picker && (
                <ShowLinkPicker
                    mode={picker}
                    onInsert={(text) => { insertAtCursor(text); setPicker(null); }}
                    onCancel={() => setPicker(null)}
                />
            )}
        </div>
    );
}
