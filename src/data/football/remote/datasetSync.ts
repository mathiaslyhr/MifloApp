/**
 * Over-the-air content sync. `scripts/publish-football-dataset.mjs` uploads a
 * content pack (players, clubs, managers, trebles, lineups, Scout schedule,
 * Red Card questions + strings) to the public `game-data` bucket; this module
 * pulls it so data edits reach installed apps without an App Store build.
 *
 * Flow: on cold start apply the cached pack, then poll the tiny manifest on
 * launch + every foreground with If-None-Match (a 304 costs ~nothing). A new
 * version downloads the content-addressed pack, verifies its checksum,
 * validates it defensively (including that this binary's bundled flag/crest
 * art covers every reference — a pack needing newer art is skipped until the
 * user updates the app), caches it, and hydrates the in-memory store — but
 * NEVER while a game/lobby screen is open (see maybeApplyPending, called on
 * every navigation change from App.tsx).
 *
 * Everything fails OPEN and silently: bundled data always works, so no error
 * here is ever worth a toast (unlike the deliberate error surfacing elsewhere).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import {APP_VERSION_CODE, SUPABASE_URL} from '../../../core/config';
import i18n from '../../../core/i18n';
import {currentRouteName} from '../../../core/navigation/navigationRef';
import {FLAG_IMAGES} from '../../../games/hattrick/assets/flags.generated';
import {LOGO_IMAGES} from '../../../games/hattrick/assets/logos.generated';
import {hashDateKey} from '../../../games/scout/dailySeed';
import {hydrate, type ContentPack} from '../store';
import type {Club, Footballer} from '../types';

const BUCKET_URL = `${SUPABASE_URL}/storage/v1/object/public/game-data`;
const CACHE_KEY = 'footballData.cache';

/** Routes where swapping the dataset cannot disturb anything in progress. */
const SAFE_ROUTES = new Set([
  'Tabs',
  'Profile',
  'Settings',
  'HowToPlay',
  'About',
  'OneDevice',
]);

type Manifest = {
  schemaVersion: number;
  version: string;
  path: string;
  checksum?: number;
};

type CacheEnvelope = {
  etag: string | null;
  manifest: Manifest;
  datasetJson: string;
  appVersionCode: string;
};

let etag: string | null = null;
let appliedVersion: string | null = null;
let pending: {pack: ContentPack; version: string} | null = null;
let started = false;

function isApplySafe(): boolean {
  const route = currentRouteName();
  return route === undefined || SAFE_ROUTES.has(route);
}

function applyPack(pack: ContentPack, version: string): void {
  hydrate(pack);
  const strings = pack.redCardQuestions?.i18n;
  if (strings) {
    for (const lang of ['en', 'da'] as const) {
      const questions = strings[lang];
      if (questions) {
        i18n.addResourceBundle(lang, 'translation', {redCard: {questions}}, true, true);
      }
    }
  }
  appliedVersion = version;
  pending = null;
}

function stagePack(pack: ContentPack, version: string): void {
  if (isApplySafe()) {
    applyPack(pack, version);
  } else {
    pending = {pack, version};
  }
}

/** Apply a staged pack once the user is back on a safe screen (nav change hook). */
export function maybeApplyPending(): void {
  try {
    if (pending && isApplySafe()) {
      applyPack(pending.pack, pending.version);
    }
  } catch {
    // Runs inside NavigationContainer.onStateChange — a throw here would crash
    // a navigation transition, and stale-but-working data is always fine.
  }
}

/**
 * Defensive schema check for a downloaded (or cached) pack. Returns an error
 * description, or null when the pack is safe to hydrate on THIS binary.
 */
export function validateContentPack(payload: unknown): string | null {
  const p = payload as {schemaVersion?: unknown} & ContentPack;
  if (typeof p !== 'object' || p === null) {
    return 'pack is not an object';
  }
  if (p.schemaVersion !== 1) {
    return `unsupported schemaVersion ${String(p.schemaVersion)}`;
  }
  if (!Array.isArray(p.footballers) || p.footballers.length < 500) {
    return 'footballers missing or truncated';
  }
  if (!Array.isArray(p.clubs) || p.clubs.length < 100) {
    return 'clubs missing or truncated';
  }
  if (
    !Array.isArray(p.managers) ||
    !Array.isArray(p.trebleSquads) ||
    !Array.isArray(p.famousLineups)
  ) {
    return 'managers/trebleSquads/famousLineups missing';
  }

  const clubIds = new Set<string>();
  for (const club of p.clubs as Club[]) {
    if (typeof club?.id !== 'string' || typeof club.name !== 'string') {
      return 'malformed club';
    }
    if (!LOGO_IMAGES[club.id]) {
      return `no bundled crest for club '${club.id}'`;
    }
    if (!FLAG_IMAGES[club.country]) {
      return `no bundled flag for club country '${club.country}'`;
    }
    clubIds.add(club.id);
  }

  const playerIds = new Set<string>();
  for (const f of p.footballers as Footballer[]) {
    if (
      typeof f?.id !== 'string' ||
      typeof f.name !== 'string' ||
      !Array.isArray(f.nationality) ||
      !Array.isArray(f.positions) ||
      !Array.isArray(f.clubs) ||
      !Array.isArray(f.honours)
    ) {
      return `malformed footballer '${String(f?.id)}'`;
    }
    for (const country of f.nationality) {
      if (!FLAG_IMAGES[country]) {
        return `no bundled flag for nationality '${country}' (${f.id})`;
      }
    }
    for (const spell of f.clubs) {
      if (!clubIds.has(spell.clubId)) {
        return `unknown club '${spell.clubId}' on '${f.id}'`;
      }
    }
    playerIds.add(f.id);
  }

  const secrets = p.scoutSchedule?.dailySecrets;
  if (typeof secrets !== 'object' || secrets === null) {
    return 'scoutSchedule missing';
  }
  for (const [dateKey, id] of Object.entries(secrets)) {
    if (!playerIds.has(id)) {
      return `schedule ${dateKey} references unknown footballer '${id}'`;
    }
  }

  const questions = p.redCardQuestions;
  if (!Array.isArray(questions?.ids) || questions.ids.length === 0) {
    return 'redCardQuestions missing';
  }
  const english = questions.i18n?.en as Record<string, string> | undefined;
  for (const id of questions.ids) {
    if (typeof english?.[id] !== 'string') {
      return `Red Card question '${id}' has no English text`;
    }
  }

  return null;
}

/** Poll the manifest; download, cache, and stage a new pack when one exists. */
export async function checkForUpdate(): Promise<void> {
  if (!SUPABASE_URL) {
    return;
  }
  try {
    const headers: Record<string, string> = {'Cache-Control': 'no-cache'};
    if (etag) {
      headers['If-None-Match'] = etag;
    }
    const res = await fetch(`${BUCKET_URL}/manifest.json`, {headers});
    if (res.status === 304 || !res.ok) {
      return;
    }
    const manifest = (await res.json()) as Manifest;
    if (typeof manifest?.version !== 'string' || typeof manifest.path !== 'string') {
      return;
    }
    // A future schema would fail validation anyway — skip the ~450 KB download
    // (and re-download every foreground) this binary can never use.
    if (manifest.schemaVersion !== 1) {
      return;
    }
    // iOS's URL cache can answer a conditional GET with a 200 — treat a
    // version we already hold as the 304 it really is.
    if (manifest.version === appliedVersion || manifest.version === pending?.version) {
      etag = res.headers.get('etag');
      return;
    }

    const dataRes = await fetch(`${BUCKET_URL}/${manifest.path}`);
    if (!dataRes.ok) {
      return;
    }
    const body = await dataRes.text();
    if (typeof manifest.checksum === 'number' && hashDateKey(body) !== manifest.checksum) {
      return;
    }
    const pack = JSON.parse(body) as ContentPack;
    if (validateContentPack(pack) !== null) {
      return;
    }

    etag = res.headers.get('etag');
    const envelope: CacheEnvelope = {
      etag,
      manifest,
      datasetJson: body,
      appVersionCode: APP_VERSION_CODE,
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
    stagePack(pack, manifest.version);
  } catch {
    // Offline / bad payload / storage failure: bundled or last-good data stays.
  }
}

/**
 * Startup entry point (fire-and-forget from App.tsx): restore the cached pack,
 * then poll now and on every return to foreground.
 */
export async function initFootballDataSync(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache = JSON.parse(raw) as CacheEnvelope;
      if (cache.appVersionCode !== APP_VERSION_CODE) {
        // New binary: its bundled data is fresher than this cache, and the
        // refetch below re-caches the remote pack under the new version.
        await AsyncStorage.removeItem(CACHE_KEY);
      } else {
        const pack = JSON.parse(cache.datasetJson) as ContentPack;
        if (validateContentPack(pack) === null) {
          etag = cache.etag;
          stagePack(pack, cache.manifest.version);
        }
      }
    }
  } catch {
    // Corrupt cache: ignore, bundled data stands.
  }
  await checkForUpdate();
  if (!started) {
    started = true;
    AppState.addEventListener('change', state => {
      if (state === 'active') {
        void checkForUpdate();
      }
    });
  }
}

/** Test-only: clear module state between cases. */
export function __resetDatasetSyncForTests(): void {
  etag = null;
  appliedVersion = null;
  pending = null;
  started = false;
}
