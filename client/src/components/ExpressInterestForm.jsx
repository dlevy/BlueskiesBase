import { useState } from 'react';
import { sendPosterInterest } from '../services/api';

const textareaClass = "w-full rounded-lg border border-white/10 bg-white/5 py-1.5 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500 resize-none";
const btnPrimary = "text-xs px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary = "text-xs px-2.5 py-1 rounded-lg border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * "Interested" button that expands into a short message form — the start of
 * a notification-based exchange with the listing owner, not a real chat.
 */
export default function ExpressInterestForm({ collectionId }) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(null);

    const handleSend = async () => {
        if (!message.trim() || sending) return;
        setSending(true);
        setError(null);
        try {
            await sendPosterInterest(collectionId, message.trim());
            setSent(true);
            setOpen(false);
            setMessage('');
        } catch (err) {
            setError(err.message || 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    if (sent) {
        return <span className="text-xs" style={{ color: '#4ade80' }}>Message sent!</span>;
    }

    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
                Interested
            </button>
        );
    }

    return (
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Say what you're offering or asking…"
                rows={2}
                className={textareaClass}
                autoFocus
            />
            {error && <p className="text-xs" style={{ color: 'var(--p-color-error)' }}>{error}</p>}
            <div className="flex gap-2">
                <button type="button" onClick={handleSend} disabled={sending || !message.trim()} className={btnPrimary}>
                    {sending ? 'Sending…' : 'Send'}
                </button>
                <button
                    type="button"
                    onClick={() => { setOpen(false); setMessage(''); setError(null); }}
                    disabled={sending}
                    className={btnSecondary}
                    style={{ color: 'var(--p-color-contrast-medium)' }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
