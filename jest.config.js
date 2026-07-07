module.exports = {
  preset: '@react-native/jest-preset',
  // The preset only transforms react-native* packages. A few deps ship ESM that
  // must be transpiled too (qrcode-svg for the QR card, the haptics module), so
  // widen the allow-list for those.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-qrcode-svg|react-native-haptic-feedback)/)',
  ],
};
