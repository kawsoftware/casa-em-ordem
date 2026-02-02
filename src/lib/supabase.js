
import { createClient } from '@supabase/supabase-js';

// Fallback values prevent the entire app from crashing (White Screen) if Env Vars are missing
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://setup-env-vars.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'public-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn('⚠️ CRITICAL: Supabase environment variables are missing! The app will not work correctly until you add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Vercel Settings.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    // Prevent AbortError spam by disabling global abort controller integration completely
    global: {
        fetch: (url, options) => {
            // Remove signal property entirely from options
            const { signal, ...rest } = options || {};
            return fetch(url, rest);
        }
    }
});
