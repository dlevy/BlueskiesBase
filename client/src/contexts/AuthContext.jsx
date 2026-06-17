import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

async function fetchProfile(userId) {
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    return data ?? null;
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);

    useEffect(() => {
        let mounted = true;
        let loadingTimer = null;

        // Drive all auth state from onAuthStateChange — never call getSession()
        // separately because it races with another tab's refresh token lock and
        // returns null even while a valid session exists in another tab.
        //
        // INITIAL_SESSION fires after Supabase's own initialize() completes.
        // SIGNED_IN fires when localStorage is updated by another tab's refresh.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            setSession(session);
            setUser(session?.user ?? null);

            if (event === 'INITIAL_SESSION') {
                if (session?.user) {
                    // Valid session on init — clear loading immediately.
                    setLoading(false);
                    fetchProfile(session.user.id)
                        .then(p => { if (mounted) setProfile(p); })
                        .catch(() => { if (mounted) setProfile(null); });
                } else {
                    // No session yet. Another tab may be mid-refresh (rotating token
                    // race): its SIGNED_IN will fire via the storage event within ~1s.
                    // Keep loading=true briefly so ProtectedRoute doesn't redirect to
                    // /login during that window. Fall through after 1.5s at most.
                    loadingTimer = setTimeout(() => {
                        if (mounted) setLoading(false);
                    }, 1500);
                }
                return;
            }

            if (event === 'SIGNED_IN') {
                // Covers both direct login and cross-tab token sync.
                if (loadingTimer) { clearTimeout(loadingTimer); loadingTimer = null; }
                setLoading(false);
                if (session?.user) {
                    fetchProfile(session.user.id)
                        .then(p => { if (mounted) setProfile(p); })
                        .catch(() => { if (mounted) setProfile(null); });
                }
                return;
            }

            if (event === 'SIGNED_OUT') {
                setProfile(null);
                setLoading(false);
                return;
            }

            // TOKEN_REFRESHED / USER_UPDATED — session/user already set above;
            // profile unchanged (avoid spurious re-fetches and risk of clearing it
            // if the fetch fails during a refresh).
        });

        return () => {
            mounted = false;
            if (loadingTimer) clearTimeout(loadingTimer);
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const signUp = async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/member-login` },
        });
        if (error) throw error;
        return data;
    };

    const signOut = async () => {
        setUser(null);
        setProfile(null);
        setSession(null);
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    // Stable reference via useCallback so PublicLayout's useEffect([getToken])
    // only re-runs when it genuinely needs to (i.e. never after mount).
    const getToken = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    }, []);

    const value = {
        user,
        profile,
        session,
        isAdmin: profile?.is_admin || false,
        loading,
        signIn,
        signUp,
        signOut,
        getToken,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
