// Build custom flat-vector illustrations for the non-honour axis chips,
// replacing the last emojis on the grid (🌐 top-leagues, 👕 shirt-number,
// 🤝 teammate, 🧤🛡️🎯⚽ positions, 🔥⭐ tags). Same metallic gold/silver family
// and pipeline as the trophies, so the whole chip set reads as one set. Each
// icon is a hand-authored SVG rasterized to a small transparent PNG and
// committed with a require-map, rendered offline via native <Image>.
//
//   npm run assets:criteria
//
// Outputs:
//   src/games/hattrick/assets/criteria/<key>.png
//   src/games/hattrick/assets/criteria.generated.ts
//     export const CRITERION_IMAGES: Record<string, number>
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {root} from './_load-football.mjs';

const SIZE = 96; // matches the trophy chips; crisp on device.
const OUT_DIR = resolve(root, 'src/games/hattrick/assets/criteria');
const GEN = resolve(root, 'src/games/hattrick/assets/criteria.generated.ts');

// Palette — same values as the trophies so the set reads as one family.
const GOLD_L = '#F4D77A', GOLD = '#E3B23C', GOLD_D = '#B07E23';
const SILV_L = '#E9EDF2', SILV = '#C3CAD4', SILV_D = '#8A93A0';
const BASE = '#2E2A24';
const BALL = '#F4F6F8'; // near-white for the football.

// viewBox 64×64, transparent background — identical frame to the trophies.
const wrap = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`;

const ICONS = {
  // Top-5 leagues — a gold globe (echoes the World Cup globe, standalone).
  'top-leagues': wrap(
    `<circle cx="32" cy="30" r="15" fill="${GOLD_L}" stroke="${GOLD_D}" stroke-width="1.6"/>` +
    `<path d="M17 30 h30 M32 15 v30" stroke="${GOLD_D}" stroke-width="1.2" fill="none"/>` +
    `<ellipse cx="32" cy="30" rx="7" ry="15" fill="none" stroke="${GOLD_D}" stroke-width="1.2"/>` +
    `<path d="M19.5 22 q12.5 6 25 0 M19.5 38 q12.5 -6 25 0" stroke="${GOLD_D}" stroke-width="1.1" fill="none"/>` +
    `<path d="M23 20 a15 15 0 0 1 9 -5" stroke="${GOLD}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  ),
  // Shirt number — a steel football jersey with a faint gold "10".
  'shirt-number': wrap(
    `<path d="M20 20 L26 16 L32 21 L38 16 L44 20 L50 26 L46 33 L42 30 L42 48 L22 48 L22 30 L18 33 L14 26 Z" ` +
      `fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M26 16 L32 22 L38 16" fill="none" stroke="${SILV_D}" stroke-width="1.3"/>` +
    `<path d="M30 34 v9" stroke="${GOLD_D}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<ellipse cx="35.5" cy="38.5" rx="2.6" ry="4.6" fill="none" stroke="${GOLD_D}" stroke-width="2.2"/>`,
  ),
  // Teammate — two overlapping figures (played alongside).
  teammate: wrap(
    `<circle cx="39" cy="23" r="6" fill="${SILV}" stroke="${SILV_D}" stroke-width="1.2"/>` +
    `<path d="M28 46 a11 11 0 0 1 22 0 Z" fill="${SILV}" stroke="${SILV_D}" stroke-width="1.2"/>` +
    `<circle cx="26" cy="25" r="7" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.3"/>` +
    `<path d="M13 48 a13 13 0 0 1 26 0 Z" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.3"/>`,
  ),
  // Goalkeeper — a silver keeper glove.
  'position-gk': wrap(
    `<rect x="22" y="28" width="20" height="16" rx="4" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.3"/>` +
    `<rect x="22.8" y="18" width="4.4" height="12" rx="2.2" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.2"/>` +
    `<rect x="27.8" y="15" width="4.4" height="15" rx="2.2" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.2"/>` +
    `<rect x="32.8" y="15" width="4.4" height="15" rx="2.2" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.2"/>` +
    `<rect x="37.8" y="18" width="4.4" height="12" rx="2.2" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.2"/>` +
    `<rect x="15" y="29.5" width="9.5" height="4.6" rx="2.3" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.2" transform="rotate(-24 20 32)"/>` +
    `<path d="M23 43 h18" stroke="${GOLD_D}" stroke-width="2"/>`,
  ),
  // Defender — a steel shield with a gold border.
  'position-df': wrap(
    `<path d="M32 15 L46 19 V33 C46 42 39 47 32 50 C25 47 18 42 18 33 V19 Z" ` +
      `fill="${SILV_L}" stroke="${GOLD_D}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M32 16 V49 M18.5 28 H45.5" stroke="${SILV_D}" stroke-width="1.3" opacity="0.75"/>`,
  ),
  // Midfielder — a compass (vision / the engine), steel with a gold needle.
  'position-mf': wrap(
    `<circle cx="32" cy="30" r="15" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.4"/>` +
    `<circle cx="32" cy="30" r="9.5" fill="none" stroke="${SILV_D}" stroke-width="1.1"/>` +
    `<path d="M32 15 v3 M32 42 v3 M17 30 h3 M44 30 h3" stroke="${SILV_D}" stroke-width="1.4"/>` +
    `<path d="M32 30 L38.5 19 L34 30 Z" fill="${GOLD}"/>` +
    `<path d="M32 30 L25.5 41 L30 30 Z" fill="${GOLD_D}"/>` +
    `<circle cx="32" cy="30" r="2.4" fill="${GOLD_L}" stroke="${GOLD_D}" stroke-width="1"/>`,
  ),
  // Forward — a classic black-and-white football (distinct from the gold ball).
  'position-fw': wrap(
    `<defs><clipPath id="fwball"><circle cx="32" cy="30" r="15"/></clipPath></defs>` +
    `<g clip-path="url(#fwball)">` +
      `<circle cx="32" cy="30" r="15" fill="${BALL}"/>` +
      `<path d="M32 22.5 l7 5.1 -2.7 8.2 h-8.6 l-2.7 -8.2 Z" fill="${BASE}"/>` +
      `<path d="M32 22.5 V12 M39 27.6 L49 24 M36.3 35.8 L42 47 M27.7 35.8 L22 47 M25 27.6 L15 24" ` +
        `stroke="#3A3A3A" stroke-width="1.3" fill="none"/>` +
      `<path d="M32 9 l6 3 -2 6 h-8 l-2 -6 Z" fill="${BASE}"/>` +
      `<circle cx="49" cy="21" r="4.6" fill="${BASE}"/>` +
      `<circle cx="45" cy="47" r="4.6" fill="${BASE}"/>` +
      `<circle cx="19" cy="47" r="4.6" fill="${BASE}"/>` +
      `<circle cx="15" cy="21" r="4.6" fill="${BASE}"/>` +
    `</g>` +
    `<circle cx="32" cy="30" r="15" fill="none" stroke="${SILV_D}" stroke-width="1.4"/>`,
  ),
  // Current stars — a gold flame.
  'tag-current-stars': wrap(
    `<path d="M32 12 C38 20 42 24 42 34 a10 12 0 0 1 -20 0 C22 27 26 26 27 21 ` +
      `C29 25 31 25 31 21 C31 17 30 15 32 12 Z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M32 25 C35 29 37 31 37 35 a5 6 0 0 1 -10 0 C27 31 29 29 32 25 Z" fill="${GOLD_L}"/>`,
  ),
  // Notable — a gold star.
  'tag-notable': wrap(
    `<path d="M32 12 L36.4 23.9 L49.1 24.4 L39.1 32.3 L42.6 44.6 L32 37.5 ` +
      `L21.4 44.6 L24.9 32.3 L14.9 24.4 L27.6 23.9 Z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M32 19 L34.9 26.8 L43.2 27.2 L36.6 32.4 L38.9 40.2 L32 35.6 ` +
      `L25.1 40.2 L27.4 32.4 L20.8 27.2 L29.1 26.8 Z" fill="${GOLD_L}"/>`,
  ),
};

rmSync(OUT_DIR, {recursive: true, force: true});
mkdirSync(OUT_DIR, {recursive: true});

const keys = Object.keys(ICONS);
for (const key of keys) {
  const svg = ICONS[key];
  await sharp(Buffer.from(svg), {density: 384})
    .resize(SIZE, SIZE, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png()
    .toFile(resolve(OUT_DIR, `${key}.png`));
}

const lines = keys
  .map(k => `  '${k}': require('./criteria/${k}.png'),`)
  .join('\n');
writeFileSync(
  GEN,
  `// AUTO-GENERATED by scripts/build-criteria-assets.mjs — do not edit by hand.\n` +
    `// Custom flat-vector illustrations for the non-honour axis chips.\n` +
    `// Regenerate with: npm run assets:criteria\n` +
    `/* eslint-disable */\n` +
    `export const CRITERION_IMAGES: Record<string, number> = {\n${lines}\n};\n`,
);

console.log(`✓ ${keys.length} criteria icons → ${OUT_DIR}`);
