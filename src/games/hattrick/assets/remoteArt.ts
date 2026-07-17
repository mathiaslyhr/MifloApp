/**
 * Over-the-air art registry. Bundled crests/flags/portraits
 * (`logos.generated.ts` / `flags.generated.ts` / `playerAvatars.ts`) are the
 * fast, offline path; this holds the URLs for art the *content pack* references
 * but THIS binary does not bundle (a club/nation added after the last App Store
 * build). `criterionIcon.ts` resolves bundled first, then falls back here.
 *
 * The maps are hydrated from `pack.remoteArt` by the sync layer
 * (remote/datasetSync.ts applyPack) whenever a pack is applied, and cleared when
 * a pack carries none — so a stale remote URL never outlives its pack.
 */
import {SUPABASE_URL} from '../../../core/config';
import type {RemoteArt} from '../../../data/football/store';

// Same public bucket the dataset pack lives in (remote/datasetSync.ts).
const BASE = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/game-data`
  : '';

let logos: Record<string, string> = {};
let flags: Record<string, string> = {};
let portraits: Record<string, string> = {};

/** Apply (or clear) the OTA art maps carried by a content pack. */
export function hydrateRemoteArt(art: RemoteArt | undefined): void {
  logos = art?.logos ?? {};
  flags = art?.flags ?? {};
  portraits = art?.portraits ?? {};
}

/** An <Image> uri source for a bucket-relative path, or null. */
function source(path: string | undefined): {uri: string} | null {
  return path && BASE ? {uri: `${BASE}/${path}`} : null;
}

/** Remote crest source for a clubId, or null when the pack carries none. */
export function remoteLogoSource(clubId: string | undefined): {uri: string} | null {
  return clubId ? source(logos[clubId]) : null;
}

/** Remote flag source for a dataset country name, or null. */
export function remoteFlagSource(country: string | undefined): {uri: string} | null {
  return country ? source(flags[country]) : null;
}

/** Remote portrait source for a footballer id, or null. */
export function remotePortraitSource(playerId: string | undefined): {uri: string} | null {
  return playerId ? source(portraits[playerId]) : null;
}

/** Test-only: reset the registry between cases. */
export function __resetRemoteArtForTests(): void {
  logos = {};
  flags = {};
  portraits = {};
}
