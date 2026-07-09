module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // The preset only transforms react-native* packages. A few deps ship ESM that
  // must be transpiled too (qrcode-svg for the QR card, the haptics module), so
  // widen the allow-list for those.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-masked-view|@react-native-async-storage|@react-navigation|@sentry|react-native-qrcode-svg|react-native-haptic-feedback)/)',
  ],
};
