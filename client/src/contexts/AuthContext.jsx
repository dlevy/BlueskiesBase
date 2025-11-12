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
        console.log('[AuthContext] Initializing auth...');

        // Check active sessions and sets the user
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            console.log('[AuthContext] Initial session check:', session ? 'Session found' : 'No session');
            setSession(session);
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
                        console.log('[AuthContext] Initial profile loaded:', profileData?.username);
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

            setSession(session);
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
                        console.log('[AuthContext] Profile loaded:', profileData?.username, 'Admin:', profileData?.is_admin);
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

        // Refresh session every 15 minutes to keep it alive
        // This is more aggressive than the default 30 minutes to prevent token expiration
        const refreshInterval = setInterval(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // Check if token is expiring soon (within 5 minutes)
                const expiresAt = session.expires_at * 1000; // Convert to milliseconds
                const now = Date.now();
                const timeUntilExpiry = expiresAt - now;
                const fiveMinutes = 5 * 60 * 1000;

                if (timeUntilExpiry < fiveMinutes) {
                    console.log('[AuthContext] Token expiring soon, refreshing immediately...');
                } else {
                    console.log('[AuthContext] Proactive session refresh...');
                }

                const { error } = await supabase.auth.refreshSession();
                if (error) {
                    console.error('[AuthContext] Error refreshing session:', error);
                } else {
                    console.log('[AuthContext] Session refreshed successfully');
                }
            }
        }, 15 * 60 * 1000); // 15 minutes

        // Additional check every 5 minutes to catch expiring tokens early
        const expiryCheckInterval = setInterval(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const expiresAt = session.expires_at * 1000;
                const now = Date.now();
                const timeUntilExpiry = expiresAt - now;
                const tenMinutes = 10 * 60 * 1000;

                // If token expires in less than 10 minutes, refresh it now
                if (timeUntilExpiry < tenMinutes) {
                    console.log('[AuthContext] Token expiring in', Math.floor(timeUntilExpiry / 60000), 'minutes, refreshing now...');
                    const { error } = await supabase.auth.refreshSession();
                    if (error) {
                        console.error('[AuthContext] Error refreshing session:', error);
                    } else {
                        console.log('[AuthContext] Session refreshed successfully');
                    }
                }
            }
        }, 5 * 60 * 1000); // Check every 5 minutes

        return () => {
            subscription.unsubscribe();
            clearInterval(refreshInterval);
            clearInterval(expiryCheckInterval);
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
        console.log('[AuthContext] Signing out...');
        try {
            // Clear local state immediately for better UX
            setUser(null);
            setProfile(null);
            setSession(null);

            // Sign out from Supabase
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('[AuthContext] Error signing out:', error);
                throw error;
            }

            console.log('[AuthContext] Sign out successful');
        } catch (error) {
            console.error('[AuthContext] Sign out failed:', error);
            // Even if signOut fails, clear local state
            setUser(null);
            setProfile(null);
            setSession(null);
            throw error;
        }
    };

    const getToken = () => {
        return session?.access_token || null;
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

