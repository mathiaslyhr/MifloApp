# Fonts — Satoshi

Miflo's primary typeface is **Satoshi** (free from [Fontshare](https://www.fontshare.com/fonts/satoshi)).
The app falls back to the system font automatically until these files are present,
so nothing breaks if they're missing.

## Add the fonts

1. Download Satoshi from Fontshare and drop these two files into this folder
   (filenames must match exactly — the PostScript name becomes the
   `fontFamily` we reference in `src/theme/typography.ts`):

   - `Satoshi-Regular.otf`  → family `Satoshi-Regular`  (weight 400)
   - `Satoshi-Medium.otf`   → family `Satoshi-Medium`   (weight 500)

2. Link them into the native iOS project:

   ```sh
   npx react-native-asset
   ```

   This copies the fonts in and adds them to `Info.plist` (`UIAppFonts`).

3. Rebuild the app on device:

   ```sh
   npx react-native run-ios --device
   ```

That's it — text across the app will switch from system to Satoshi.
