/* eslint-env jest */
/**
 * Global jest setup — stand-ins for native modules that have no JS fallback.
 */
// Device locale detection (used by core/i18n at import time). The package
// ships its own jest mock (en-US defaults).
jest.mock('react-native-localize', () =>
  require('react-native-localize/mock'),
);

// AsyncStorage's native module is null under jest; the official in-memory
// mock keeps the supabase auth client (and our preference stores) from
// crashing the worker when a test imports the real client.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// Notifee (Scout's local daily reminder) is a native module with no JS
// fallback; its shipped jest mock keeps screens that import it renderable.
jest.mock('@notifee/react-native', () =>
  require('@notifee/react-native/jest-mock'),
);

// react-native-keychain (the durable identity vault) is a native module with
// no JS fallback under jest. A tiny in-memory stand-in keeps the vault's
// callers renderable; tests that exercise the vault mock it explicitly.
jest.mock('react-native-keychain', () => {
  let store = null;
  return {
    ACCESSIBLE: {AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock'},
    setGenericPassword: jest.fn(async (username, password) => {
      store = {username, password};
      return true;
    }),
    getGenericPassword: jest.fn(async () => store ?? false),
    resetGenericPassword: jest.fn(async () => {
      store = null;
      return true;
    }),
  };
});
