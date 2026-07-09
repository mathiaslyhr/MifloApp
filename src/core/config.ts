/**
 * App-level constants that aren't design tokens.
 */

/**
 * Where the Home QR code points — meant to be the App Store listing so friends
 * can scan to download Miflo. Placeholder until the app ships; swap in the real
 * App Store URL here.
 */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6786893093';

/**
 * Base for shareable party join links (universal links). The website serves
 * /join/<code> with an "open in app / get the app" fallback; devices with the
 * app installed open the Join screen directly (see linking in App.tsx).
 */
export const JOIN_URL_BASE = 'https://miflo.dk/join';

/**
 * Shown in the Menu footer and Settings. Bump on each release; mirrors the
 * native marketing version / build number until a build-time source is wired.
 */
export const APP_VERSION = '1.0 (5)';

/**
 * Machine-comparable version for the update gate, compared against the remote
 * `min_supported_version`. Scheme: marketing `major.minor` + build number →
 * `major.minor.build` (so "1.0 (3)" → "1.0.3"). Bump the build segment on every
 * release so `min_supported_version` can gate older builds.
 */
export const APP_VERSION_CODE = '1.0.5';

/**
 * Privacy policy linked from Settings. Placeholder until the page is published;
 * swap in the real URL here.
 */
export const PRIVACY_POLICY_URL = 'https://miflo.dk/privacy';

/**
 * FAQ linked from the Menu. The page isn't published on the marketing site yet;
 * this points at where it will live — swap in the real URL once it ships.
 */
export const FAQ_URL = 'https://miflo.dk/faq';

/**
 * Feedback / bug-report page on the marketing site, linked from the Menu's About
 * group. Placeholder until the page is published; swap in the real URL here.
 */
export const FEEDBACK_URL = 'https://miflo.dk/feedback';

/**
 * Sentry crash-reporting DSN. Publishable value, safe to commit. Paste the DSN
 * from your Sentry project here; leaving it empty disables Sentry entirely.
 * Sentry only initializes in Release builds with a non-empty DSN (see
 * `src/core/observability/sentry.ts`).
 */
export const SENTRY_DSN: string =
  'https://8085245d0ea8de3dc4786188a01ccb3a@o4511699949584384.ingest.de.sentry.io/4511699955286096';

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
