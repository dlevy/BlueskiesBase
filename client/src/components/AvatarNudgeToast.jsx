import { Link } from 'react-router-dom';

export default function AvatarNudgeToast({ onDismiss }) {
    return (
        <div
            className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-50 rounded-xl border border-white/10 shadow-xl p-4 space-y-2.5"
            style={{ background: '#1a1e26' }}
            role="status"
        >
            <p className="text-sm" style={{ color: 'var(--p-color-primary)' }}>
                Nice! Add a profile photo so people know it's you.
            </p>
            <div className="flex items-center gap-3">
                <Link
                    to="/profile/edit"
                    onClick={onDismiss}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all"
                >
                    Add Photo
                </Link>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="text-xs"
                    style={{ color: 'var(--p-color-contrast-medium)' }}
                >
                    Not now
                </button>
            </div>
        </div>
    );
}
