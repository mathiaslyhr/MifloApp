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
