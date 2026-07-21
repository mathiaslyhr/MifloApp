// Build custom flat-vector trophy illustrations for the honour axis chips,
// replacing the emoji (🏆🌍🏅👟). Each honour type gets a hand-authored SVG,
// rasterized to a small transparent PNG and committed with a require-map so the
// app renders them offline via native <Image> (same approach as flags/logos).
//
//   npm run assets:trophies
//
// Outputs:
//   src/games/hattrick/assets/trophies/<honour>.png
//   src/games/hattrick/assets/trophies.generated.ts
//     export const TROPHY_IMAGES: Record<HonourType, number>
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {root} from './_load-football.mjs';

const SIZE = 96; // ~3x the honour chip; crisp on device.
const OUT_DIR = resolve(root, 'src/games/hattrick/assets/trophies');
const GEN = resolve(root, 'src/games/hattrick/assets/trophies.generated.ts');

// Palette — shared so the set reads as one family.
const GOLD_L = '#F4D77A', GOLD = '#E3B23C', GOLD_D = '#B07E23';
const SILV_L = '#E9EDF2', SILV = '#C3CAD4', SILV_D = '#8A93A0';
// Bronze — keeps the domestic cup distinct from the silver Champions League cup.
const BRZ_L = '#E7B98F', BRZ = '#C87F45', BRZ_D = '#8A5220';
const BASE = '#2E2A24';

// A stepped dark plinth most trophies stand on.
const plinth = (y = 52) =>
  `<rect x="20" y="${y + 4}" width="24" height="6" rx="1.5" fill="${BASE}"/>` +
  `<rect x="24" y="${y}" width="16" height="5" rx="1" fill="#3E382F"/>`;

// SVG per honour. viewBox 64×64, transparent background.
const wrap = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`;

const TROPHIES = {
  // World title — a laurel wreath around a star. A generic "champion of the
  // world" mark, deliberately sharing no shape with any real trophy.
  'world-cup': wrap(
    `<path d="M32 53 C22 51 17 41 19 29" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M32 53 C42 51 47 41 45 29" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<g fill="${GOLD_L}">` +
    `<ellipse cx="18" cy="31" rx="2.3" ry="3.8" transform="rotate(-32 18 31)"/>` +
    `<ellipse cx="19.5" cy="39" rx="2.3" ry="3.8" transform="rotate(-12 19.5 39)"/>` +
    `<ellipse cx="23.5" cy="46" rx="2.3" ry="3.8" transform="rotate(22 23.5 46)"/>` +
    `<ellipse cx="46" cy="31" rx="2.3" ry="3.8" transform="rotate(32 46 31)"/>` +
    `<ellipse cx="44.5" cy="39" rx="2.3" ry="3.8" transform="rotate(12 44.5 39)"/>` +
    `<ellipse cx="40.5" cy="46" rx="2.3" ry="3.8" transform="rotate(-22 40.5 46)"/>` +
    `</g>` +
    `<path d="M32 19 l2.9 6 6.5.9 -4.7 4.6 1.1 6.5 -5.8-3 -5.8 3 1.1-6.5 -4.7-4.6 6.5-.9 Z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1"/>`,
  ),
  // Champions League — silver "big ears" cup.
  'champions-league': wrap(
    plinth(50) +
    `<path d="M24 20 h16 v12 a8 9 0 0 1 -16 0 Z" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.3"/>` +
    `<path d="M24 24 C14 24 14 40 26 41" fill="none" stroke="${SILV}" stroke-width="3.2"/>` +
    `<path d="M40 24 C50 24 50 40 38 41" fill="none" stroke="${SILV}" stroke-width="3.2"/>` +
    `<rect x="28" y="41" width="8" height="9" fill="${SILV}"/>` +
    `<rect x="22" y="18" width="20" height="3" rx="1.5" fill="${SILV}"/>`,
  ),
  // Europa League — gold flared cup on a black octagonal base.
  'europa-league': wrap(
    plinth(50) +
    `<path d="M20 20 L44 20 L38 34 a6 7 0 0 1 -12 0 Z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1.3"/>` +
    `<rect x="30" y="40" width="4" height="10" fill="${GOLD_D}"/>` +
    `<ellipse cx="32" cy="41" rx="7" ry="2.4" fill="${GOLD}"/>` +
    `<path d="M20 20 L44 20" stroke="${GOLD_L}" stroke-width="2"/>`,
  ),
  // Euros (Henri Delaunay) — slim tall silver cup, small handles.
  'european-championship': wrap(
    plinth(52) +
    `<path d="M27 18 h10 v14 a5 6 0 0 1 -10 0 Z" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.2"/>` +
    `<path d="M27 22 C21 22 21 30 27 30" fill="none" stroke="${SILV}" stroke-width="2.2"/>` +
    `<path d="M37 22 C43 22 43 30 37 30" fill="none" stroke="${SILV}" stroke-width="2.2"/>` +
    `<rect x="30" y="38" width="4" height="14" fill="${SILV}"/>` +
    `<ellipse cx="32" cy="52" rx="7" ry="2.2" fill="${SILV_D}"/>`,
  ),
  // Copa América — wide silver bowl on a tall stem.
  'copa-america': wrap(
    plinth(54) +
    `<path d="M20 22 h24 l-4 10 a8 5 0 0 1 -16 0 Z" fill="${SILV_L}" stroke="${SILV_D}" stroke-width="1.2"/>` +
    `<rect x="30" y="40" width="4" height="14" fill="${SILV}"/>` +
    `<ellipse cx="32" cy="40" rx="6" ry="2" fill="${SILV}"/>` +
    `<rect x="19" y="20" width="26" height="3" rx="1.5" fill="${SILV}"/>`,
  ),
  // Ballon d'Or — gold football on a plinth.
  'ballon-dor': wrap(
    plinth(48) +
    `<rect x="30" y="40" width="4" height="9" fill="${GOLD_D}"/>` +
    `<circle cx="32" cy="24" r="14" fill="${GOLD_L}" stroke="${GOLD_D}" stroke-width="1.4"/>` +
    `<path d="M32 16 l4 3 -1.5 5 h-5 L28 19 Z" fill="${GOLD_D}"/>` +
    `<path d="M32 16 l0 -3M36 19 l3 -1M35 24 l3 3M29 24 l-3 3M28 19 l-3 -1" stroke="${GOLD_D}" stroke-width="1.1"/>`,
  ),
  // Golden Boot — a gold football boot.
  'golden-boot': wrap(
    `<path d="M16 34 C16 28 20 26 26 26 L30 26 C33 26 34 30 40 32 C46 34 50 34 50 39 L50 42 C50 44 48 45 46 45 L18 45 C16 45 14 43 14 40 Z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1.4"/>` +
    `<path d="M26 27 l1.5 8M31 28 l1 7M36 31 l1 5" stroke="${GOLD_D}" stroke-width="1.1"/>` +
    `<rect x="15" y="45" width="36" height="4" rx="1.5" fill="${GOLD_D}"/>` +
    `<path d="M18 40 h28" stroke="${GOLD_L}" stroke-width="1.4"/>`,
  ),
  // League title — gold two-handled winners' cup with a star.
  'league-title': wrap(
    plinth(50) +
    `<path d="M25 19 h14 v11 a7 8 0 0 1 -14 0 Z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1.3"/>` +
    `<path d="M25 22 C18 22 18 31 26 32" fill="none" stroke="${GOLD}" stroke-width="2.6"/>` +
    `<path d="M39 22 C46 22 46 31 38 32" fill="none" stroke="${GOLD}" stroke-width="2.6"/>` +
    `<rect x="29" y="39" width="6" height="11" fill="${GOLD}"/>` +
    `<path d="M32 21.5 l1.4 3 3.2.3 -2.4 2.1.8 3.1 -3-1.7 -3 1.7.8-3.1 -2.4-2.1 3.2-.3 Z" fill="${GOLD_L}"/>`,
  ),
  // Domestic cup (FA-Cup style) — silver lidded cup with tall handles.
  'domestic-cup': wrap(
    plinth(52) +
    `<path d="M26 24 h12 v9 a6 7 0 0 1 -12 0 Z" fill="${BRZ_L}" stroke="${BRZ_D}" stroke-width="1.2"/>` +
    `<path d="M26 26 C19 26 19 34 27 35" fill="none" stroke="${BRZ}" stroke-width="2.4"/>` +
    `<path d="M38 26 C45 26 45 34 37 35" fill="none" stroke="${BRZ}" stroke-width="2.4"/>` +
    `<path d="M24 24 h16 l-2 -4 h-12 Z" fill="${BRZ}"/>` +
    `<circle cx="32" cy="17" r="2.4" fill="${BRZ_L}" stroke="${BRZ_D}" stroke-width="1"/>` +
    `<rect x="30" y="40" width="4" height="12" fill="${BRZ}"/>`,
  ),
  // Player of the season — gold star medal.
  'player-of-the-season': wrap(
    `<path d="M27 40 h10 l-1.5 12 a3.5 3 0 0 1 -7 0 Z" fill="${GOLD_D}"/>` +
    `<circle cx="32" cy="24" r="15" fill="${GOLD_L}" stroke="${GOLD_D}" stroke-width="1.4"/>` +
    `<path d="M32 14 l2.8 5.7 6.2.9 -4.5 4.4 1.1 6.2 -5.6-2.9 -5.6 2.9 1.1-6.2 -4.5-4.4 6.2-.9 Z" fill="${GOLD}"/>`,
  ),
};

rmSync(OUT_DIR, {recursive: true, force: true});
mkdirSync(OUT_DIR, {recursive: true});

const keys = Object.keys(TROPHIES);
for (const key of keys) {
  const svg = TROPHIES[key];
  await sharp(Buffer.from(svg), {density: 384})
    .resize(SIZE, SIZE, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png()
    .toFile(resolve(OUT_DIR, `${key}.png`));
}

const lines = keys
  .map(k => `  '${k}': require('./trophies/${k}.png'),`)
  .join('\n');
writeFileSync(
  GEN,
  `// AUTO-GENERATED by scripts/build-trophy-assets.mjs — do not edit by hand.\n` +
    `// Custom flat-vector trophy illustrations for honour axis chips.\n` +
    `// Regenerate with: npm run assets:trophies\n` +
    `/* eslint-disable */\n` +
    `export const TROPHY_IMAGES: Record<string, number> = {\n${lines}\n};\n`,
);

console.log(`✓ ${keys.length} trophies → ${OUT_DIR}`);
