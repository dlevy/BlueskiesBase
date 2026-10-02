import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAvatarNudge } from '../contexts/AvatarNudgeContext';
import { addThanks, removeThanks } from '../services/api';

function HeartIcon({ filled }) {
    return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-6.716-4.35-9.428-8.272C.814 9.953 1.5 6.5 4.5 5.1 7 3.93 9.5 5 12 8c2.5-3 5-4.07 7.5-2.9 3 1.4 3.686 4.853 1.928 7.628C18.716 16.65 12 21 12 21z" />
        </svg>
    );
}

function namesLabel(names) {
    if (names.length === 1) return `Thanked by ${names[0]}`;
    if (names.length === 2) return `Thanked by ${names[0]} and ${names[1]}`;
    if (names.length === 3) return `Thanked by ${names[0]}, ${names[1]} and ${names[2]}`;
    return `Thanked by ${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

// Same instant/dismissible-on-tap hover tooltip pattern as Avatar.jsx's
// BadgeTooltip — a native `title` is OS-delayed and unusable on touch.
function NamesTooltip({ names }) {
    if (names.length === 0) return null;
    return (
        <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium opacity-0 scale-95 transition-all duration-100 ease-out group-hover/thanks:opacity-100 group-hover/thanks:scale-100"
            style={{ background: '#14171d', color: '#fff', border: '1px solid rgba(245,158,11,0.4)' }}
        >
            {namesLabel(names)}
        </span>
    );
}

/**
 * A toggleable "thanks" control shown next to a piece of content's owner
 * attribution. Always renders (count stays publicly visible, including to
 * logged-out visitors and the content's own owner) — only interactive when
 * the viewer is logged in and isn't the content's owner, otherwise it's a
 * static, correctly-colored pill. Hovering a pill with at least one thanks
 * shows who gave it.
 */
export default function ThanksButton({ contentType, contentId, count, thankedByMe, thankedByNames = [], isOwnContent, onToggled }) {
    const { user } = useAuth();
    const triggerAvatarNudge = useAvatarNudge();
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
                triggerAvatarNudge();
            }
            await onToggled?.();
        } catch (err) {
            console.error('Error toggling thanks:', err);
        } finally {
            setPending(false);
        }
    };

    return (
        <span className="relative inline-block group/thanks">
            <button
                type="button"
                onClick={interactive ? handleClick : undefined}
                disabled={!interactive || pending}
                aria-pressed={thankedByMe}
                title={!interactive ? namesLabel(thankedByNames) || undefined : undefined}
                className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-xs font-medium transition-all disabled:opacity-100 ${
                    interactive ? 'cursor-pointer hover:brightness-110' : 'cursor-default'
                }`}
                style={thankedByMe
                    ? { color: '#f59e0b', borderColor: 'rgba(245,158,11,0.45)', background: 'rgba(245,158,11,0.12)' }
                    : { color: 'var(--p-color-contrast-medium)', borderColor: 'rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)' }}
            >
                <HeartIcon filled={thankedByMe} />
                {thankedByMe ? 'Thanked' : 'Thanks'}
                {count > 0 && <span className="opacity-80">· {count}</span>}
            </button>
            <NamesTooltip names={thankedByNames} />
        </span>
    );
}
