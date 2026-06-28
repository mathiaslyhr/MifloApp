/**
 * App-level constants that aren't design tokens.
 */

/**
 * Where the Home QR code points — meant to be the App Store listing so friends
 * can scan to download Miflo. Placeholder until the app ships; swap in the real
 * App Store URL here.
 */
export const APP_STORE_URL = 'https://apps.apple.com/app/miflo';

/**
 * Supabase backend (rooms + realtime lobby). The anon key is the public client
 * key — it's protected by Row Level Security, so it's safe to commit. Paste your
 * project's values here; leaving them empty keeps the app in local/solo mode
 * (create/join surface a "backend not configured" message instead of crashing).
 */
export const SUPABASE_URL: string = 'https://hppsryxrdzxzusruftrj.supabase.co';
export const SUPABASE_ANON_KEY: string =
  'sb_publishable_jHMICgkNwOnDs2NPmuEg-g_QIE5u2x3';

/** Whether a Supabase backend is configured — gates all room/network features. */
export const isBackendConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';
