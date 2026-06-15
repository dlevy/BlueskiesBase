import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
    'When was "In Bloom" last played?',
    'What are the most played songs?',
    'How many shows were there in 2024?',
];

function TypingIndicator() {
    return (
        <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ background: 'var(--p-color-surface)' }}>
                <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                            style={{ background: 'var(--p-color-info)', animationDelay: `${i * 0.15}s` }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function Message({ role, content }) {
    const isUser = role === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className="max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                style={{
                    background: isUser ? 'var(--p-color-primary)' : 'var(--p-color-surface)',
                    color: 'var(--p-color-primary)',
                    borderRadius: isUser ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                }}
            >
                {content}
            </div>
        </div>
    );
}

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

    const sendMessage = async (text) => {
        const content = (text || input).trim();
        if (!content || isLoading) return;
        const userMsg = { role: 'user', content };
        const next = [...messages, userMsg];
        setMessages(next);
        setInput('');
        setIsLoading(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: next })
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || 'Sorry, something went wrong.' }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't reach the server. Please try again." }]);
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {isOpen && (
                <div className="w-80 sm:w-96 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10"
                    style={{ height: '500px', background: 'var(--p-color-canvas)' }}>
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-white/10"
                        style={{ background: 'var(--p-color-surface)' }}>
                        <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--p-color-primary)' }}>Ask about the shows</p>
                            <p className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>AI-powered setlist assistant</p>
                        </div>
                        <button onClick={() => setIsOpen(false)}
                            className="p-1 rounded-lg hover:bg-white/10 transition-colors" aria-label="Close chat"
                            style={{ color: 'var(--p-color-contrast-medium)' }}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.length === 0 && (
                            <div className="text-center mt-4 space-y-2">
                                <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    Ask anything about the setlist archive!
                                </p>
                                {SUGGESTIONS.map(s => (
                                    <button key={s} onClick={() => sendMessage(s)}
                                        className="block w-full text-left text-xs px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
                                        style={{ color: 'var(--p-color-info)' }}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                        {messages.map((msg, i) => <Message key={i} role={msg.role} content={msg.content} />)}
                        {isLoading && <TypingIndicator />}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-white/10 shrink-0">
                        <div className="flex gap-2">
                            <input ref={inputRef} type="text" value={input}
                                onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                                placeholder="Ask a question…" disabled={isLoading}
                                className="flex-1 rounded-xl px-3 py-2 text-sm border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] placeholder:text-gray-500 disabled:opacity-60" />
                            <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
                                className="rounded-xl px-3 py-2 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ background: 'var(--p-color-primary)', color: 'var(--p-color-canvas)' }}
                                aria-label="Send">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toggle button */}
            <button onClick={() => setIsOpen(o => !o)}
                className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                style={{ background: 'var(--p-color-primary)', color: 'var(--p-color-canvas)' }}
                aria-label={isOpen ? 'Close chat' : 'Open chat'}>
                {isOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                    </svg>
                )}
            </button>
        </div>
    );
}
