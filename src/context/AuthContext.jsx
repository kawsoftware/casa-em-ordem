import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Helper: Fetch Profile safely
    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, organizations(name)') // Try to join org name if possible
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.warn("Profile fetch warning:", error.message);
            }
            return data;
        } catch (err) {
            console.error("Unexpected error fetching profile:", err);
            return null;
        }
    };

    // Helper: Ensure Profile Exists (Self-Healing)
    const ensureProfileExists = async (sessionUser) => {
        try {
            console.log("Checking profile for", sessionUser.id);
            let p = await fetchProfile(sessionUser.id);

            // 1. If profile is completely missing
            if (!p) {
                console.warn("Profile missing. Attempting to create recovery profile...");

                // Create default org
                const { data: newOrg, error: orgError } = await supabase
                    .from('organizations')
                    .insert({ name: 'Minha Empresa' })
                    .select()
                    .single();

                if (orgError) {
                    console.error("Failed to create backup organization:", orgError);
                    // Try to find ANY organization to attach to? Or stop.
                    return null;
                }

                // Create profile
                const { data: newProfile, error: profError } = await supabase
                    .from('profiles')
                    .insert({
                        id: sessionUser.id,
                        full_name: sessionUser.user_metadata?.full_name || 'Admin',
                        role: 'admin',
                        organization_id: newOrg.id
                    })
                    .select()
                    .single();

                if (profError) console.error("Failed to create backup profile:", profError);
                p = newProfile;
            }
            // 2. If profile exists but has no organization
            else if (!p.organization_id) {
                console.warn("Profile has no organization. Fixing...");
                const { data: newOrg } = await supabase.from('organizations').insert({ name: 'Minha Empresa' }).select().single();
                if (newOrg) {
                    await supabase.from('profiles').update({ organization_id: newOrg.id }).eq('id', sessionUser.id);
                    p.organization_id = newOrg.id;
                }
            }

            return p;

        } catch (err) {
            console.error("Self-healing error:", err);
            return null; // Fail gracefully
        }
    };

    useEffect(() => {
        let mounted = true;

        // Main Initialization
        const init = async () => {
            try {
                console.log("Auth: Initializing...");
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) throw error;

                if (mounted) {
                    setSession(session);
                    setUser(session?.user ?? null);

                    if (session?.user) {
                        // Run logic to fetch or create profile
                        const p = await ensureProfileExists(session.user);
                        if (mounted) setProfile(p);
                    }
                }
            } catch (e) {
                console.error("Auth Init Validation Error:", e);
            } finally {
                console.log("Auth: Done loading.");
                if (mounted) setLoading(false);
            }
        };

        init();

        // Event Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            console.log("Auth: State change", event);

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                // Avoid re-running heavy healing on every refresh token, but basic fetch is needed
                // For safety, just fetch.
                const p = await fetchProfile(session.user.id);
                if (mounted) setProfile(p);
            } else {
                if (mounted) setProfile(null);
            }

            setLoading(false);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        }
    }, []);

    const value = {
        session,
        user,
        profile,
        loading,
        signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
        signUp: (email, password, options) => supabase.auth.signUp({ email, password, options }),
        signOut: () => supabase.auth.signOut(),
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
