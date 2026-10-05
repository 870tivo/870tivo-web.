import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Synchronizes Supabase auth session tokens to cookies for Astro middleware validation.
 */
export function setAuthCookies(session: { access_token: string; refresh_token: string; expires_in?: number } | null) {
  if (typeof document === 'undefined') return;

  const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';

  if (session?.access_token) {
    const maxAge = session.expires_in || 3600;
    const refreshMaxAge = 60 * 60 * 24 * 7; // 7 days
    document.cookie = `sb-access-token=${session.access_token}; Path=/; Max-Age=${maxAge}; SameSite=Lax${isSecure}`;
    if (session.refresh_token) {
      document.cookie = `sb-refresh-token=${session.refresh_token}; Path=/; Max-Age=${refreshMaxAge}; SameSite=Lax${isSecure}`;
    }
  } else {
    document.cookie = `sb-access-token=; Path=/; Max-Age=0; SameSite=Lax${isSecure}`;
    document.cookie = `sb-refresh-token=; Path=/; Max-Age=0; SameSite=Lax${isSecure}`;
  }
}

/**
 * Clears Supabase auth cookies.
 */
export function clearAuthCookies() {
  setAuthCookies(null);
}