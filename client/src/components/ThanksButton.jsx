import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addThanks, removeThanks } from '../services/api';

function HeartIcon({ filled }) {
    return (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-6.716-4.35-9.428-8.272C.814 9.953 1.5 6.5 4.5 5.1 7 3.93 9.5 5 12 8c2.5-3 5-4.07 7.5-2.9 3 1.4 3.686 4.853 1.928 7.628C18.716 16.65 12 21 12 21z" />
        </svg>
    );
}

/**
 * A toggleable "thanks" control shown next to a piece of content's owner
 * attribution. Always renders (count stays publicly visible, including to
 * logged-out visitors and the content's own owner) — only interactive when
 * the viewer is logged in and isn't the content's owner, otherwise it's a
 * static, correctly-colored count.
 */
export default function ThanksButton({ contentType, contentId, count, thankedByMe, isOwnContent, onToggled }) {
    const { user } = useAuth();
    const [pending, setPending] = useState(false);
    const interactive = !!user && !isOwnContent;

    const handleClick = async () => {
        if (!interactive || pending) return;
        setPending(true);
        try {
            if (thankedByMe) {
                await removeThanks(contentType, contentId);
            } else {
                await addThanks(contentType, contentId);
            }
            await onToggled?.();
        } catch (err) {
            console.error('Error toggling thanks:', err);
        } finally {
            setPending(false);
        }
    };

    return (
        <button
            type="button"
            onClick={interactive ? handleClick : undefined}
            disabled={!interactive || pending}
            aria-pressed={thankedByMe}
            title={interactive ? (thankedByMe ? 'Un-thank' : 'Say thanks') : undefined}
            className={`inline-flex items-center gap-1 text-xs transition-opacity ${
                interactive ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
            } disabled:opacity-100`}
            style={{ color: thankedByMe ? '#f59e0b' : 'var(--p-color-contrast-low)' }}
        >
            <HeartIcon filled={thankedByMe} />
            {count > 0 && <span>{count}</span>}
        </button>
    );
}
