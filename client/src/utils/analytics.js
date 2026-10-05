import { supabase } from '../services/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const SESSION_KEY = 'skysets_analytics_session';

// One random id per browser, not per person — persisted in localStorage so
// repeat visits in the same browser count as the same "session" for rough
// unique-visitor counting. Never sent anywhere except our own API, and
// carries no identity on its own (the server separately attaches user_id/
// role only when a valid auth token is present — see loadRequesterOptional).
function getSessionId() {
    try {
        let id = localStorage.getItem(SESSION_KEY);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(SESSION_KEY, id);
        }
        return id;
    } catch {
        // Private browsing / storage blocked — fall back to a per-pageload
        // id rather than losing the event entirely.
        return crypto.randomUUID();
    }
}

async function currentAuthToken() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || null;
    } catch {
        return null;
    }
}

async function send(eventType, eventName, meta) {
    try {
        const token = await currentAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        await fetch(`${API_BASE_URL}/api/analytics/event`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                eventType,
                eventName,
                path: window.location.pathname + window.location.search,
                sessionId: getSessionId(),
                referrer: document.referrer || null,
                ...meta,
            }),
            keepalive: true, // lets the request finish even if the user navigates away immediately
        });
    } catch (err) {
        // Analytics must never break the page it's trying to measure.
        console.error('[analytics] Failed to log event:', err);
    }
}

export function trackPageview() {
    send('pageview', window.location.pathname);
}

export function trackEvent(eventName) {
    send('feature', eventName);
}
