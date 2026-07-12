/**
 * Persisted skin preference (Light / Dark / System), mirroring the language
 * preference in `core/i18n`. This module only reads/writes the stored value;
 * the live re-render is owned by `SkinProvider`, which holds the preference in
 * state and resolves it against the device color scheme.
 *
 * Resolution: a saved override → the device appearance (`useColorScheme`) → the
 * light skin.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {ColorSchemeName} from 'react-native';
import {SYSTEM_SKIN, type SkinId} from '../../theme/skins';

/** What the user picked in Settings — a concrete skin or "follow system". */
export type SkinPreference = 'system' | SkinId;

const STORAGE_KEY = 'app.skin';

/**
 * Resolve a preference to the skin we actually apply. `system` follows the
 * device (`useColorScheme()`, which is `null` before it's known → light).
 */
export function resolveSkin(
  pref: SkinPreference,
  systemScheme: ColorSchemeName,
): SkinId {
  if (pref === 'light' || pref === 'dark') {
    return pref;
  }
  return systemScheme === 'dark' ? SYSTEM_SKIN.dark : SYSTEM_SKIN.light;
}

/** Read the saved preference ('system' when nothing is stored). */
export async function getSkinPreference(): Promise<SkinPreference> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Ignore storage errors — fall back to system.
  }
  return 'system';
}

/**
 * Persist a skin preference. The provider applies it to the live tree; a failed
 * write rejects so the caller can tell the user it won't survive a relaunch
 * (same contract as language/haptics).
 */
export async function setSkinPreference(pref: SkinPreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, pref);
}
