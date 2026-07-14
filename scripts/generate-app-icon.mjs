// Generates the Miflo app icon: the rounded lowercase "m" wordmark with the
// brand-purple ball as its period. Idempotent — safe to re-run any time the
// mark or brand color changes.
//
//   npm run icons      (or)      node scripts/generate-app-icon.mjs
//
// Appearance model (iOS 18 light/dark icons): we ship NO baked background —
// the system decides it.
//   icon-1024.png       light appearance: black m + purple ball on opaque
//                       white (the App Store light icon must have no alpha)
//   icon-1024-dark.png  dark appearance: white m + purple ball on a
//                       TRANSPARENT canvas — iOS composites its own dark
//                       gray gradient behind it
//
// Also refreshes the Android mipmaps and the iOS LaunchLogo imageset (the
// dark art, shown on the #121212 launch screen).

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- brand values
const BRAND = '#6260FF'; // the ball (src/theme/colors.ts primary)
const INK_LIGHT = '#0A0A0A'; // the m on the light icon
const INK_DARK = '#FFFFFF'; // the m on the dark icon
const LIGHT_BG = '#FFFFFF';

// -------------------------------------------------------------------- geometry
// 1024 master canvas. The m is a single stroked polyline with round caps: a
// long left stem, two semicircular humps, a long middle leg and a SHORT right
// leg; the ball hangs below-right of the short leg like the wordmark's period.
const S = 1024;
const STROKE = 92;
const R = 100; // hump radius (centerline)
const X1 = 302; // left stem centerline (centers the whole mark incl. ball)
const X2 = X1 + 2 * R; // middle leg
const X3 = X2 + 2 * R; // right leg
const Y_ARC = 430; // hump center height (centerline)
const Y_BOT = 660; // left/middle leg bottom (centerline)
const Y_BOT_R = 510; // the short right leg bottom (centerline) — trimmed vs
// the old mark so the ball below gets air without moving away

// The ball: brand purple, tucked below the short right leg like the
// wordmark's period.
const BALL_R = 54;
const BALL_CX = X3; // straight under the right leg (matches the boot splash)
const BALL_CY = 650;

const M_PATH = [
  `M ${X1} ${Y_BOT} L ${X1} ${Y_ARC} A ${R} ${R} 0 0 1 ${X2} ${Y_ARC} L ${X2} ${Y_BOT}`,
  `M ${X2} ${Y_ARC} A ${R} ${R} 0 0 1 ${X3} ${Y_ARC} L ${X3} ${Y_BOT_R}`,
].join(' ');

/** The mark on a transparent canvas; `ink` colors the m, the ball is brand. */
function markSvg(ink, background = null) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  ${background ? `<rect width="${S}" height="${S}" fill="${background}"/>` : ''}
  <path d="${M_PATH}" fill="none" stroke="${ink}" stroke-width="${STROKE}"
    stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${BALL_CX}" cy="${BALL_CY}" r="${BALL_R}" fill="${BRAND}"/>
</svg>`;
}

// ------------------------------------------------------------------- rasterize
async function main() {
  const iosDir = resolve(root, 'ios/Miflo/Images.xcassets/AppIcon.appiconset');

  // Light: opaque white ground (the 1024 App Store icon must carry no alpha).
  const light = await sharp(Buffer.from(markSvg(INK_LIGHT, LIGHT_BG)))
    .removeAlpha()
    .png()
    .toBuffer();
  writeFileSync(resolve(iosDir, 'icon-1024.png'), light);

  // Dark: transparent — iOS paints its own dark gradient behind the mark.
  const dark = await sharp(Buffer.from(markSvg(INK_DARK))).png().toBuffer();
  writeFileSync(resolve(iosDir, 'icon-1024-dark.png'), dark);
  console.log('✓ iOS icon-1024.png (light, opaque) + icon-1024-dark.png (dark, transparent)');

  // Android launcher mipmaps (opaque; the dark art on the app background).
  const androidDensities = [
    ['mdpi', 48],
    ['hdpi', 72],
    ['xhdpi', 96],
    ['xxhdpi', 144],
    ['xxxhdpi', 192],
  ];
  const androidArt = Buffer.from(markSvg(INK_DARK, '#121212'));
  for (const [density, size] of androidDensities) {
    const dir = resolve(root, `android/app/src/main/res/mipmap-${density}`);
    mkdirSync(dir, { recursive: true });
    const square = await sharp(androidArt).resize(size, size).removeAlpha().png().toBuffer();
    writeFileSync(resolve(dir, 'ic_launcher.png'), square);
    const circleMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
    );
    const round = await sharp(square)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    writeFileSync(resolve(dir, 'ic_launcher_round.png'), round);
  }
  console.log('✓ Android mipmaps (ic_launcher + ic_launcher_round)');

  // iOS launch-screen logo: the bare dark mark on a transparent canvas,
  // centered on the #121212 launch background (LaunchScreen.storyboard).
  const launchDir = resolve(root, 'ios/Miflo/Images.xcassets/LaunchLogo.imageset');
  mkdirSync(launchDir, { recursive: true });
  const launchScales = [
    ['launch-logo.png', 180],
    ['launch-logo@2x.png', 360],
    ['launch-logo@3x.png', 540],
  ];
  for (const [name, size] of launchScales) {
    const art = await sharp(Buffer.from(markSvg(INK_DARK))).resize(size, size).png().toBuffer();
    writeFileSync(resolve(launchDir, name), art);
  }
  writeFileSync(
    resolve(launchDir, 'Contents.json'),
    JSON.stringify(
      {
        images: [
          { idiom: 'universal', filename: 'launch-logo.png', scale: '1x' },
          { idiom: 'universal', filename: 'launch-logo@2x.png', scale: '2x' },
          { idiom: 'universal', filename: 'launch-logo@3x.png', scale: '3x' },
        ],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2,
    ) + '\n',
  );
  console.log('✓ iOS LaunchLogo.imageset (@1x/@2x/@3x)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
