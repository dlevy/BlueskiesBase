import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Every redirect-based email link in this app (signup confirmation, admin
        // password resets) is generated server-side via the plain supabase-js
        // client, which defaults to 'implicit'. PKCE requires the *same browser*
        // that requested the link to hold a locally-stored code verifier, which is
        // architecturally impossible when an admin sends the link to someone
        // else's browser — a client/server flowType mismatch makes auth-js throw
        // "Not a valid PKCE flow url." and silently fail to establish a session.
        flowType: 'implicit',
        storage: window.localStorage,
        storageKey: 'blueskiesbase-auth',
        // Keep session alive indefinitely
        // Supabase default is 1 hour, we'll refresh before expiry
        // The autoRefreshToken will handle this automatically
    }
});

