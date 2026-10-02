import { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import AvatarNudgeToast from '../components/AvatarNudgeToast';

const AvatarNudgeContext = createContext(null);

function storageKey(userId) {
    return `avatarNudgeShown:${userId}`;
}

/**
 * A one-time "add a profile photo" nudge, fired from the moment-of-intent
 * call sites (first comment, first thanks given, first mark-attended) —
 * not a cold onboarding step. Never shown to someone who already has a
 * photo (that's already a strong signal they've filled out what they want
 * to), and only shown once per account even if they never add one.
 */
export function AvatarNudgeProvider({ children }) {
    const { user, profile } = useAuth();
    const [visible, setVisible] = useState(false);

    const trigger = useCallback(() => {
        if (!user || profile?.avatar_url) return;

        let alreadyShown = false;
        try {
            alreadyShown = !!localStorage.getItem(storageKey(user.id));
        } catch {
            // localStorage unavailable (private window, blocked storage) — fall
            // through and show it this once; nothing to persist either way.
        }
        if (alreadyShown) return;

        setVisible(true);
        try {
            localStorage.setItem(storageKey(user.id), '1');
        } catch {
            // Best-effort only — a storage failure just means it might show again later.
        }
    }, [user, profile]);

    return (
        <AvatarNudgeContext.Provider value={trigger}>
            {children}
            {visible && <AvatarNudgeToast onDismiss={() => setVisible(false)} />}
        </AvatarNudgeContext.Provider>
    );
}

export function useAvatarNudge() {
    const trigger = useContext(AvatarNudgeContext);
    if (!trigger) {
        throw new Error('useAvatarNudge must be used within an AvatarNudgeProvider');
    }
    return trigger;
}
