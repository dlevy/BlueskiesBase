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

    useEffect(() => {
        console.log('[AuthContext] Initializing auth...');

        // Check active sessions and sets the user
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            console.log('[AuthContext] Initial session check:', session ? 'Session found' : 'No session');
            setUser(session?.user ?? null);

            // Fetch user profile to get admin status
            if (session?.user) {
                try {
                    const { data: profileData, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (error) {
                        console.error('[AuthContext] Error fetching profile:', error);
                        setProfile(null);
                    } else {
                        console.log('[AuthContext] Initial profile loaded:', profileData.username);
                        setProfile(profileData);
                    }
                } catch (err) {
                    console.error('[AuthContext] Error fetching profile:', err);
                    setProfile(null);
                }
            } else {
                setProfile(null);
            }

            setLoading(false);
        }).catch(err => {
            console.error('[AuthContext] Error getting session:', err);
            setLoading(false);
        });

        // Listen for changes on auth state (sign in, sign out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AuthContext] Auth state changed:', event);

            setUser(session?.user ?? null);

            // Fetch user profile to get admin status
            if (session?.user) {
                try {
                    console.log('[AuthContext] Fetching profile for user:', session.user.email);
                    const { data: profileData, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (error) {
                        console.error('[AuthContext] Error fetching profile:', error);
                        setProfile(null);
                    } else {
                        console.log('[AuthContext] Profile loaded:', profileData.username, 'Admin:', profileData.is_admin);
                        setProfile(profileData);
                    }
                } catch (err) {
                    console.error('[AuthContext] Error fetching profile:', err);
                    setProfile(null);
                }
            } else {
                console.log('[AuthContext] No user session, clearing profile');
                setProfile(null);
            }

            setLoading(false);
        });

        // Refresh session every 30 minutes to keep it alive
        const refreshInterval = setInterval(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log('[AuthContext] Refreshing session...');
                const { error } = await supabase.auth.refreshSession();
                if (error) {
                    console.error('[AuthContext] Error refreshing session:', error);
                } else {
                    console.log('[AuthContext] Session refreshed successfully');
                }
            }
        }, 30 * 60 * 1000); // 30 minutes

        return () => {
            subscription.unsubscribe();
            clearInterval(refreshInterval);
        };
    }, []);

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    };

    const signUp = async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
        return data;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const value = {
        user,
        profile,
        isAdmin: profile?.is_admin || false,
        loading,
        signIn,
        signUp,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

