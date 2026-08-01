/**
 * Persisted user preferences that aren't language (which lives in core/i18n).
 * The haptics toggle and the guided tour's run-once flag. Reads/writes
 * AsyncStorage and keeps the live haptics engine flag in sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {setHapticsEnabled} from '../haptics';

const HAPTICS_KEY = 'app.haptics';
const TOUR_KEY = 'app.tourSeen';

/** Read the saved haptics preference (defaults on). */
export async function getHapticsPreference(): Promise<boolean> {
  try {
    const saved = await AsyncStorage.getItem(HAPTICS_KEY);
    return saved !== 'off';
  } catch {
    return true;
  }
}

/**
 * Persist + apply the haptics preference. The change always applies for this
 * session; a failed write rejects so the caller can tell the user it won't
 * survive a relaunch.
 */
export async function setHapticsPreference(enabled: boolean): Promise<void> {
  setHapticsEnabled(enabled);
  await AsyncStorage.setItem(HAPTICS_KEY, enabled ? 'on' : 'off');
}

/** Apply the saved haptics preference to the engine on boot. */
export async function loadHapticsPreference(): Promise<void> {
  const enabled = await getHapticsPreference();
  setHapticsEnabled(enabled);
}

/**
 * Whether the guided tour has already run on this device. Fails closed (true)
 * so a broken storage read can never trap the user in a replaying tour.
 */
export async function getTourSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(TOUR_KEY)) != null;
  } catch {
    return true;
  }
}

/** Mark the guided tour as done (finished or skipped alike). */
export async function setTourSeen(): Promise<void> {
  await AsyncStorage.setItem(TOUR_KEY, '1');
}
