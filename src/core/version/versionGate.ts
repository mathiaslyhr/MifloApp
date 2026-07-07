/**
 * Version gate — blocks play on app builds older than the remotely-configured
 * minimum supported version (`app_config.min_supported_version`, migration 0013).
 *
 * Fail-open by design: if the backend is unconfigured or unreachable we never
 * lock anyone out over a network blip — only a successfully-read minimum that
 * this build falls below produces a block.
 */
import {supabase} from '../supabase/client';
import {APP_VERSION_CODE} from '../config';
import {isVersionSupported} from './semver';

export {compareVersions, isVersionSupported} from './semver';

/**
 * Read the minimum supported version from the backend. Returns null when the
 * backend is unconfigured/unreachable or the row is missing (→ fail-open).
 */
export async function fetchMinSupportedVersion(): Promise<string | null> {
  if (!supabase) {
    return null;
  }
  try {
    const {data, error} = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'min_supported_version')
      .maybeSingle();
    if (error || !data?.value) {
      return null;
    }
    return String(data.value);
  } catch {
    return null;
  }
}

/**
 * Resolve whether this build is blocked. `true` only when a minimum was read
 * AND this build is below it; `false` on any error / missing config.
 */
export async function isUpdateRequired(
  current: string = APP_VERSION_CODE,
): Promise<boolean> {
  const min = await fetchMinSupportedVersion();
  if (!min) {
    return false;
  }
  return !isVersionSupported(current, min);
}
