// Generates the Miflo app icon: the app's pastel "rainbow" mesh gradient with a
// frosted-glass rounded "M". Idempotent — safe to re-run any time the brand
// gradient or glass recipe changes.
//
//   npm run icons      (or)      node scripts/generate-app-icon.mjs
//
// Outputs:
//   ios/Miflo/Images.xcassets/AppIcon.appiconset/icon-1024.png       (light / any)
//   ios/Miflo/Images.xcassets/AppIcon.appiconset/icon-1024-dark.png  (dark appearance — same art)
//   android/app/src/main/res/mipmap-*/ic_launcher.png + ic_launcher_round.png
//
// Design values are lifted directly from the app:
//   gradient wash + blooms → src/core/ui/MeshBackground.tsx
//   glass fill/rim/shadow  → src/core/ui/CircleButton.tsx, src/theme/colors.ts

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- brand values
// 8-stop vertical pastel wash (MeshBackground.tsx BASE)
const WASH = [
  [0, '#fdf2f7'],
  [0.15, '#f7e5ef'],
  [0.3, '#ece6f8'],
  [0.44, '#e1e7f7'],
  [0.57, '#e6f1fb'],
  [0.7, '#e2f3ea'],
  [0.84, '#f1f2d8'],
  [1, '#f9e8d2'],
];

// Soft radial blooms for depth (subset of MeshBackground.tsx RAINBOW). cy is the
// vertical center (0..1), side places the core at 25% / 75% of the width.
const BLOOMS = [
  { rgb: '240,150,190', alpha: 0.24, cy: 0.06, side: 'left' }, // pink
  { rgb: '150,148,240', alpha: 0.2, cy: 0.24, side: 'right' }, // purple
  { rgb: '88,142,228', alpha: 0.22, cy: 0.42, side: 'left' }, // blue
  { rgb: '90,206,168', alpha: 0.22, cy: 0.64, side: 'right' }, // green
  { rgb: '246,184,132', alpha: 0.24, cy: 0.9, side: 'left' }, // orange
];

// -------------------------------------------------------------------- geometry
const S = 1024; // master canvas
// Rounded geometric M, matching the current icon. Polyline: bottom-left → top-left
// → center valley → top-right → bottom-right, stroked with round caps/joins.
const STROKE = 122; // M limb thickness
const RIM = 14; // bright glass rim, total (7px each side)
const xL = 312;
const xR = 712;
const yTop = 316;
const yBot = 726;
const xMid = 512;
const yValley = 566;
const M_PATH = `M ${xL} ${yBot} L ${xL} ${yTop} L ${xMid} ${yValley} L ${xR} ${yTop} L ${xR} ${yBot}`;

// glass recipe (colors.ts) pushed toward a clearly white M: near-opaque white
// body with a subtle top→bottom sheen + bright rim so it still reads as glass,
// not flat. Keeps legibility down to 40px.
const GLASS_TOP = 'rgba(255,255,255,0.97)';
const GLASS_BOT = 'rgba(255,255,255,0.80)';
const GLASS_RIM = 'rgba(255,255,255,0.95)';
const SHADOW = '#140F32';

function bloomDefs() {
  return BLOOMS.map((b, i) => {
    return `<radialGradient id="bloom${i}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgb(${b.rgb})" stop-opacity="${b.alpha}"/>
      <stop offset="100%" stop-color="rgb(${b.rgb})" stop-opacity="0"/>
    </radialGradient>`;
  }).join('\n');
}

function bloomShapes() {
  const rx = S * 0.85;
  const ry = S * 1.05 * 0.3;
  return BLOOMS.map((b, i) => {
    const cx = b.side === 'left' ? S * 0.25 : S * 0.75;
    const cy = b.cy * S;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#bloom${i})"/>`;
  }).join('\n');
}

function washStops() {
  return WASH.map(([o, c]) => `<stop offset="${o * 100}%" stop-color="${c}"/>`).join('\n');
}

function svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="0" y2="${S}" gradientUnits="userSpaceOnUse">
      ${washStops()}
    </linearGradient>
    ${bloomDefs()}
    <linearGradient id="glass" x1="0" y1="${yTop}" x2="0" y2="${yBot}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${GLASS_TOP}"/>
      <stop offset="100%" stop-color="${GLASS_BOT}"/>
    </linearGradient>
    <filter id="lift" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="${SHADOW}" flood-opacity="0.16"/>
    </filter>
  </defs>

  <!-- pastel background -->
  <rect width="${S}" height="${S}" fill="url(#wash)"/>
  ${bloomShapes()}

  <!-- frosted glass M: shadow + bright rim + translucent gradient body -->
  <g filter="url(#lift)">
    <path d="${M_PATH}" fill="none" stroke="${GLASS_RIM}" stroke-width="${STROKE + RIM}"
      stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${M_PATH}" fill="none" stroke="url(#glass)" stroke-width="${STROKE}"
      stroke-linecap="round" stroke-linejoin="round"/>
    <!-- subtle top highlight -->
    <path d="${M_PATH}" fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="${STROKE * 0.22}"
      stroke-linecap="round" stroke-linejoin="round" transform="translate(0,-9)" opacity="0.9"/>
  </g>
</svg>`;
}

// ------------------------------------------------------------------- rasterize
async function main() {
  // iOS App Store icons must NOT have an alpha channel — Apple rejects any 1024
  // icon with transparency. The art is fully opaque (the wash rect covers the
  // whole canvas), so removeAlpha() is lossless; it just drops the empty channel.
  const iosMaster = await sharp(Buffer.from(svg())).removeAlpha().png().toBuffer();

  const iosDir = resolve(root, 'ios/Miflo/Images.xcassets/AppIcon.appiconset');
  writeFileSync(resolve(iosDir, 'icon-1024.png'), iosMaster);
  writeFileSync(resolve(iosDir, 'icon-1024-dark.png'), iosMaster); // same art in both appearances
  console.log('✓ iOS icon-1024.png + icon-1024-dark.png (opaque RGB)');

  // Android launcher mipmaps (square + round mask).
  const androidDensities = [
    ['mdpi', 48],
    ['hdpi', 72],
    ['xhdpi', 96],
    ['xxhdpi', 144],
    ['xxxhdpi', 192],
  ];
  for (const [density, size] of androidDensities) {
    const dir = resolve(root, `android/app/src/main/res/mipmap-${density}`);
    mkdirSync(dir, { recursive: true });
    const square = await sharp(Buffer.from(svg())).resize(size, size).png().toBuffer();
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

  // iOS launch-screen logo: the same icon art with iOS-style rounded corners,
  // shown centered on the brand wash in LaunchScreen.storyboard. 180pt base →
  // @1x/@2x/@3x. Transparent outside the rounded rect so it sits on the flat
  // launch background like the home-screen icon.
  const launchDir = resolve(root, 'ios/Miflo/Images.xcassets/LaunchLogo.imageset');
  mkdirSync(launchDir, { recursive: true });
  const launchScales = [
    ['launch-logo.png', 180],
    ['launch-logo@2x.png', 360],
    ['launch-logo@3x.png', 540],
  ];
  for (const [name, size] of launchScales) {
    const r = Math.round(size * 0.2237); // iOS icon corner radius ratio
    const roundedMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
    );
    const art = await sharp(Buffer.from(svg())).resize(size, size).png().toBuffer();
    const rounded = await sharp(art)
      .composite([{ input: roundedMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    writeFileSync(resolve(launchDir, name), rounded);
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
  console.log('✓ iOS LaunchLogo.imageset (rounded, @1x/@2x/@3x)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
