import { createContext, useContext, useState, useEffect } from 'react';
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
        // Step 1: resolve initial session synchronously so loading clears immediately.
        // This is the reliable path — getSession() reads localStorage directly.
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                setProfile(await fetchProfile(session.user.id));
            }
            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });

        // Step 2: listen for subsequent changes (sign-in, sign-out, token refresh
        // from this tab or any other tab via localStorage storage event).
        // autoRefreshToken:true in the client handles all renewal — no manual
        // intervals needed, and manual intervals cause multi-tab token conflicts.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // INITIAL_SESSION duplicates what getSession() already handled above.
            if (event === 'INITIAL_SESSION') return;

            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                setProfile(await fetchProfile(session.user.id));
            } else {
                setProfile(null);
            }
        });

        return () => subscription.unsubscribe();
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

    const getToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    };

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
