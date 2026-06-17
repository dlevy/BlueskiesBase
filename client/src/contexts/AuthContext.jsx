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

        const initAuth = async () => {
            try {
                console.log('[Auth] getSession starting');
                const { data: { session } } = await supabase.auth.getSession();
                console.log('[Auth] getSession resolved, session:', session ? session.user?.email : 'none');
                if (!mounted) return;
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    // Fire profile fetch without awaiting — loading clears immediately
                    // once session is known; profile state updates when it resolves.
                    fetchProfile(session.user.id)
                        .then(p => { if (mounted) setProfile(p); })
                        .catch(() => { if (mounted) setProfile(null); });
                }
            } catch (err) {
                console.log('[Auth] getSession error:', err?.message);
            } finally {
                // Guaranteed to fire as soon as getSession() resolves, regardless
                // of whether the profile fetch above completes.
                console.log('[Auth] setLoading(false) firing');
                if (mounted) setLoading(false);
            }
        };

        initAuth();

        // Listen for subsequent changes (sign-in, sign-out, token refresh from
        // this tab or any other tab via localStorage storage event).
        // autoRefreshToken:true handles all renewal — no manual intervals needed.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[Auth] onAuthStateChange event:', event, session ? session.user?.email : 'no session');
            if (event === 'INITIAL_SESSION') return;
            if (!mounted) return;
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                try {
                    const p = await fetchProfile(session.user.id);
                    if (mounted) setProfile(p);
                } catch {
                    if (mounted) setProfile(null);
                }
            } else {
                setProfile(null);
            }
        });

        return () => {
            mounted = false;
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
