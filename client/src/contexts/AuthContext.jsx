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

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);

    useEffect(() => {
        // onAuthStateChange fires INITIAL_SESSION immediately with the current session,
        // then TOKEN_REFRESHED / SIGNED_IN / SIGNED_OUT as they happen.
        // autoRefreshToken: true in the client handles all renewal — no manual intervals needed.
        // Using getSession() alongside this causes a race condition and should be avoided.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                try {
                    const { data: profileData, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    setProfile(error ? null : profileData);
                } catch {
                    setProfile(null);
                }
            } else {
                setProfile(null);
            }

            // Mark initial load complete after the first event (INITIAL_SESSION)
            if (event === 'INITIAL_SESSION') {
                setLoading(false);
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
