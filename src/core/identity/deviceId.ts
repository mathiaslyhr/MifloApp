import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Device identity. Miflo has no login — a player is a persisted device id
 * plus a chosen nickname. This lives in `core` because identity spans every
 * game, not just the quiz.
 */
const DEVICE_ID_KEY = 'miflo.deviceId';
const NICKNAME_KEY = 'miflo.nickname';

/** RFC4122-ish v4 uuid without a native crypto dependency. */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Returns the persisted device id, generating and storing one on first run. */
export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const id = uuidv4();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export async function getNickname(): Promise<string | null> {
  return AsyncStorage.getItem(NICKNAME_KEY);
}

export async function setNickname(nickname: string): Promise<void> {
  await AsyncStorage.setItem(NICKNAME_KEY, nickname.trim());
}
