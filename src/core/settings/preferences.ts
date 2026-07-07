/**
 * Persisted user preferences that aren't language (which lives in core/i18n).
 * Currently just the haptics toggle. Reads/writes AsyncStorage and keeps the
 * live haptics engine flag in sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {setHapticsEnabled} from '../haptics';

const HAPTICS_KEY = 'app.haptics';

/** Read the saved haptics preference (defaults on). */
export async function getHapticsPreference(): Promise<boolean> {
  try {
    const saved = await AsyncStorage.getItem(HAPTICS_KEY);
    return saved !== 'off';
  } catch {
    return true;
  }
}

/** Persist + apply the haptics preference. */
export async function setHapticsPreference(enabled: boolean): Promise<void> {
  setHapticsEnabled(enabled);
  try {
    await AsyncStorage.setItem(HAPTICS_KEY, enabled ? 'on' : 'off');
  } catch {
    // Non-fatal — the change still applies for this session.
  }
}

/** Apply the saved haptics preference to the engine on boot. */
export async function loadHapticsPreference(): Promise<void> {
  const enabled = await getHapticsPreference();
  setHapticsEnabled(enabled);
}
