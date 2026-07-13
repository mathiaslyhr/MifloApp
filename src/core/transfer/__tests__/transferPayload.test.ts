import AsyncStorage from '@react-native-async-storage/async-storage';
import {snapshotLocal, restoreLocal, TRANSFER_KEYS} from '../transferPayload';

// The payload is what rides to a new phone when a profile moves. Two invariants
// matter: the daily streaks/history/settings DO travel, and device-/identity-
// specific keys (the auth session, the outbox, the push-token guard, the device
// id) must NEVER be carried or restored — carrying them would corrupt the new
// phone's identity or leak the old session.
const MUST_NOT_TRAVEL = [
  'social.profile',
  'social.outbox',
  'push.lastUploadedToken',
  'miflo.deviceId',
];

describe('transfer payload allowlist', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('snapshots the daily/settings keys but not identity/device keys', async () => {
    await AsyncStorage.setItem('mystery.streak', '7');
    await AsyncStorage.setItem('app.skin', 'aurora');
    await AsyncStorage.setItem('miflo.nickname', 'Ada');
    // Present but excluded — must not appear in the snapshot.
    await AsyncStorage.setItem('social.outbox', '[{"secret":true}]');
    await AsyncStorage.setItem('push.lastUploadedToken', 'abc123');
    await AsyncStorage.setItem('miflo.deviceId', 'device-xyz');

    const snap = await snapshotLocal();

    expect(snap['mystery.streak']).toBe('7');
    expect(snap['app.skin']).toBe('aurora');
    expect(snap['miflo.nickname']).toBe('Ada');
    for (const key of MUST_NOT_TRAVEL) {
      expect(snap[key]).toBeUndefined();
    }
  });

  it('omits absent keys rather than storing empty values', async () => {
    await AsyncStorage.setItem('tenball.streak', '3');
    const snap = await snapshotLocal();
    expect(Object.keys(snap)).toEqual(['tenball.streak']);
  });

  it('restore writes allowlisted keys and drops anything off-list', async () => {
    await restoreLocal({
      'journeyman.history': '[1,2,3]',
      'app.haptics': 'off',
      // A tampered/foreign key must be ignored, never written.
      'sb-project-auth-token': 'stolen-session',
      'social.outbox': '[]',
    });

    expect(await AsyncStorage.getItem('journeyman.history')).toBe('[1,2,3]');
    expect(await AsyncStorage.getItem('app.haptics')).toBe('off');
    expect(await AsyncStorage.getItem('sb-project-auth-token')).toBeNull();
    expect(await AsyncStorage.getItem('social.outbox')).toBeNull();
  });

  it('never lists an excluded key in the allowlist', () => {
    for (const key of MUST_NOT_TRAVEL) {
      expect(TRANSFER_KEYS as readonly string[]).not.toContain(key);
    }
  });
});
