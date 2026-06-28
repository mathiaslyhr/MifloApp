/**
 * Native asset + autolinking config. Fonts dropped into assets/fonts are
 * bundled into the iOS app when you run `npx react-native-asset`.
 */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./assets/fonts/'],
};
