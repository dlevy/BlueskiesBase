const SESSION_KEY = 'stale-chunk-reload-at';
const COOLDOWN_MS = 10_000; // long enough to kill a reload loop, short enough not to block recovery from a later deploy in a long-lived tab

// Shared by main.jsx's vite:preloadError listener and ErrorBoundary's
// fallback for the same failure reaching it directly as a thrown error
// (see either call site for the full explanation). A plain "already
// attempted" flag would work once, then permanently block auto-recovery for
// the rest of that tab's life if a second, later deploy hits the same tab -
// so this only blocks a reload that fires again within COOLDOWN_MS of the
// last one, which is what an actual loop (a chunk that's still missing right
// after reloading) looks like.
export function reloadForStaleChunk() {
    const lastAttempt = Number(sessionStorage.getItem(SESSION_KEY) || 0);
    if (Date.now() - lastAttempt < COOLDOWN_MS) return;
    sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    window.location.reload();
}
