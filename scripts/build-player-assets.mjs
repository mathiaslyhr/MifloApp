// Build flat-vector player portraits for the "played with X" teammate axis
// chips, replacing the 🤝 emoji. Every portrait is generated from ONE shared
// bust rig (head geometry, cel shading, feature construction) plus a small
// per-player config (skin, hair, beard, jersey) — so the set is stylistically
// consistent by construction, same approach as the trophies/flags/logos.
//
//   npm run assets:players
//
// Outputs:
//   src/games/tic-tac-toe/assets/players/<name>.png   (128px, transparent)
//
// The require-map in ../src/games/tic-tac-toe/assets/playerAvatars.ts is
// hand-maintained: filenames here MUST match the ones referenced there.
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {root} from './_load-football.mjs';

const SIZE = 128; // chips render at 24×24; 128 keeps the legend modal crisp.
const OUT_DIR = resolve(root, 'src/games/tic-tac-toe/assets/players');

// ── Palette ──────────────────────────────────────────────────────────────
// Skin: 3-tone cel sets (base + right/bottom rim shadow + deep for features).
const SKIN = {
  pale: {base: '#F2C9A4', shadow: '#DFAE83', deep: '#B98657'},
  light: {base: '#EDBE93', shadow: '#D9A171', deep: '#B67F4B'},
  tan: {base: '#DFAB77', shadow: '#C68D58', deep: '#A16B3B'},
  brown: {base: '#B27A4B', shadow: '#96603A', deep: '#71462B'},
  dark: {base: '#8B5A33', shadow: '#714626', deep: '#54331D'},
  deep: {base: '#6E4423', shadow: '#57351C', deep: '#3E2513'},
};
const HAIR = {
  black: '#1A1512',
  darkBrown: '#33241A',
  brown: '#54381F',
  lightBrown: '#7A5731',
  blonde: '#C79A4B',
  ginger: '#A85A28',
  grey: '#9C9C9C',
};

// ── Shared bust rig (viewBox 64×64) ─────────────────────────────────────
// Head: egg shape, chin at ~42.5, half-width 13, centered on x=32.
const HEAD =
  'M32 8 C41.5 8 45.5 14.5 45.5 23 C45.5 31 42.5 37.5 37.5 41.2 ' +
  'C34.8 43.2 29.2 43.2 26.5 41.2 C21.5 37.5 18.5 31 18.5 23 C18.5 14.5 22.5 8 32 8 Z';
// Shoulders: cropped at the bottom edge like the reference busts.
const TORSO =
  'M5 64 C6 53 14 47.5 23 45.5 L41 45.5 C50 47.5 58 53 59 64 Z';

const wrap = inner =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`;

// Cel shading trick: paint the whole head in the shadow tone, then the same
// path nudged up-left in the base tone, clipped to the head — leaves a
// consistent rim shadow on the right/bottom (light from upper-left).
function head(skin) {
  return (
    `<path d="${HEAD}" fill="${skin.shadow}"/>` +
    `<g clip-path="url(#head)"><path d="${HEAD}" fill="${skin.base}" transform="translate(-1.6 -1)"/></g>`
  );
}

function ears(skin) {
  return (
    `<ellipse cx="19" cy="26.5" rx="2.7" ry="3.8" fill="${skin.base}"/>` +
    `<ellipse cx="45" cy="26.5" rx="2.7" ry="3.8" fill="${skin.shadow}"/>` +
    `<ellipse cx="19.4" cy="26.5" rx="1.3" ry="2" fill="${skin.shadow}"/>` +
    `<ellipse cx="44.6" cy="26.5" rx="1.3" ry="2" fill="${skin.deep}"/>`
  );
}

function neck(skin) {
  // Sits in the chin's shade, so shadow tone throughout.
  return `<path d="M26.5 36 H37.5 V47.5 Q32 51 26.5 47.5 Z" fill="${skin.shadow}"/>`;
}

// Facial features. opts: {browTilt, mouth: 'smile'|'neutral'|'grin', eye}
function face(skin, hairColor, opts = {}) {
  const browTilt = opts.browTilt ?? 0; // degrees, + = stern
  const eye = opts.eye ?? '#2E2018';
  const brow = (cx, dir) =>
    `<rect x="${cx - 3.2}" y="21.2" width="6.4" height="1.9" rx="0.95" fill="${hairColor}" ` +
    `transform="rotate(${browTilt * dir} ${cx} 22.1)"/>`;
  const eyeAt = cx =>
    `<ellipse cx="${cx}" cy="25.4" rx="2.5" ry="1.65" fill="#F7F2EA"/>` +
    `<circle cx="${cx}" cy="25.6" r="1.15" fill="${eye}"/>` +
    `<path d="M${cx - 2.5} 24.6 q2.5 -1.6 5 0" stroke="${skin.deep}" stroke-width="0.7" fill="none"/>`;
  const nose =
    `<path d="M31.4 26 L30.6 31.2 Q31.8 32.8 34 31.6" stroke="${skin.deep}" ` +
    `stroke-width="0.95" stroke-linecap="round" fill="none"/>`;
  const mouths = {
    smile: `<path d="M28.4 35.3 q3.6 2.6 7.2 0" stroke="#8A4A38" stroke-width="1.15" stroke-linecap="round" fill="none"/>`,
    neutral: `<path d="M28.8 35.8 q3.2 1 6.4 0" stroke="#8A4A38" stroke-width="1.1" stroke-linecap="round" fill="none"/>`,
    grin:
      `<path d="M27.6 34.4 a4.4 3.2 0 0 0 8.8 0 Z" fill="#6E3A2C"/>` +
      `<rect x="28.5" y="34.4" width="7" height="1.35" rx="0.65" fill="#FFF7EE"/>`,
  };
  return (
    brow(26, 1) +
    brow(38, -1) +
    eyeAt(26) +
    eyeAt(38) +
    nose +
    mouths[opts.mouth ?? 'smile']
  );
}

// Beards follow the exact head silhouette (clipped rect), so they always fit.
// kind: 'none' | 'stubble' | 'short' | 'full'; mouth area is re-cut on top.
function beard(skin, color, kind) {
  if (kind === 'none') {
    return '';
  }
  const solid = kind !== 'stubble';
  const yTop = kind === 'full' ? 30.5 : 32.5;
  const opacity = solid ? 1 : 0.25;
  const chin =
    kind === 'full'
      ? `<path d="M25 40 Q32 47.5 39 40 Q38 45.5 32 45.5 Q26 45.5 25 40 Z" fill="${color}" opacity="${opacity}"/>`
      : '';
  return (
    `<g clip-path="url(#head)"><rect x="14" y="${yTop}" width="36" height="30" fill="${color}" opacity="${opacity}"/></g>` +
    chin +
    // re-open the mouth area
    `<ellipse cx="32" cy="35.2" rx="4" ry="2.2" fill="${skin.base}"/>` +
    (solid
      ? `<path d="M27.6 33.6 q4.4 -2.4 8.8 0 q-4.4 -0.9 -8.8 0 Z" fill="${color}"/>`
      : '')
  );
}

// ── Hair styles ──────────────────────────────────────────────────────────
// Each returns shapes drawn over the head. Sideburns included where natural.
const sideburns = c =>
  `<path d="M18.6 20 h2.6 v7.5 l-2.2 -1 Z" fill="${c}"/>` +
  `<path d="M45.4 20 h-2.6 v7.5 l2.2 -1 Z" fill="${c}"/>`;

const HAIRSTYLES = {
  bald: () => '',
  buzz: c =>
    `<path d="M32 7.6 C41.8 7.6 46 14 45.9 21.5 C45.5 17.8 43.5 16.2 39.5 15.6 C35.5 15 28.5 15 24.5 15.6 C20.5 16.2 18.5 17.8 18.1 21.5 C18 14 22.2 7.6 32 7.6 Z" fill="${c}" opacity="0.85"/>` +
    sideburns(c),
  crop: c =>
    `<path d="M32 7.2 C42 7.2 46.2 13.5 46 21.5 C45.6 17.5 43.5 15.8 39.5 15.2 C35.5 14.6 28.5 14.6 24.5 15.2 C20.5 15.8 18.4 17.5 18 21.5 C17.8 13.5 22 7.2 32 7.2 Z" fill="${c}"/>` +
    sideburns(c),
  quiff: c =>
    `<path d="M32 5.8 C42.5 5.8 46.3 13 46 21.5 C45.6 17.5 43.5 15.8 39.5 15.2 C35.5 14.6 28.5 14.6 24.5 15.2 C20.5 15.8 18.4 17.5 18 21.5 C17.7 14.5 20 8.6 26 6.6 C27.8 6 29.8 5.8 32 5.8 Z" fill="${c}"/>` +
    `<path d="M25.5 15 C23 11.6 23.2 7.9 26.4 5.9 C25.2 9.2 25.9 12.5 28.2 14.7 Z" fill="${c}"/>` +
    sideburns(c),
  slick: c =>
    `<path d="M32 7 C42 7 46.2 13.5 46 21.5 C45.8 17 44.5 14.8 41.5 14.2 C37.5 13.4 26.5 13.4 22.5 14.2 C19.5 14.8 18.2 17 18 21.5 C17.8 13.5 22 7 32 7 Z" fill="${c}"/>` +
    sideburns(c),
  curls: c =>
    `<path d="M32 6.8 C42.2 6.8 46.3 13.5 46 21.5 C45.7 18 44.6 16.6 42.8 16 Q42 17.4 40.4 16.6 Q39.4 17.8 37.6 16.4 Q36.2 17.6 34.4 16.2 Q32.8 17.4 31 16.2 Q29.4 17.4 27.6 16.4 Q26 17.6 24.8 16.4 Q23 17.2 21.2 16 C19.4 16.6 18.3 18 18 21.5 C17.7 13.5 21.8 6.8 32 6.8 Z" fill="${c}"/>` +
    sideburns(c),
  blondeTop: (c, accent) =>
    // dark sides + contrast dyed top (Aubameyang / Pogba pattern)
    `<path d="M32 7.2 C42 7.2 46.2 13.5 46 21.5 C45.6 17.5 43.5 15.8 39.5 15.2 C35.5 14.6 28.5 14.6 24.5 15.2 C20.5 15.8 18.4 17.5 18 21.5 C17.8 13.5 22 7.2 32 7.2 Z" fill="${c}"/>` +
    `<path d="M24.8 15.1 C24 10.6 26.4 7 32 7 C37.6 7 40 10.6 39.2 15.1 C36.9 14.7 34.5 14.5 32 14.5 C29.5 14.5 27.1 14.7 24.8 15.1 Z" fill="${accent}"/>` +
    sideburns(c),
  keeperShort: c =>
    `<path d="M32 7.4 C41.8 7.4 45.9 13.8 45.9 21 C45.4 17.6 43.4 16 39.5 15.4 C35.5 14.8 28.5 14.8 24.5 15.4 C20.6 16 18.6 17.6 18.1 21 C18.1 13.8 22.2 7.4 32 7.4 Z" fill="${c}"/>` +
    sideburns(c),
};

// ── Jerseys ──────────────────────────────────────────────────────────────
// spec: {pattern, primary, secondary?, collar?, collarStyle?: 'crew'|'v'}
function jersey(spec) {
  const {pattern, primary, secondary, collar} = spec;
  let body = `<path d="${TORSO}" fill="${primary}"/>`;
  if (pattern === 'stripes') {
    const bands = [];
    for (let x = 8; x < 60; x += 10) {
      bands.push(`<rect x="${x}" y="44" width="5" height="22" fill="${secondary}"/>`);
    }
    body += `<g clip-path="url(#torso)">${bands.join('')}</g>`;
  } else if (pattern === 'sleeves') {
    body +=
      `<g clip-path="url(#torso)">` +
      `<path d="M5 64 C6 53 14 47.5 23 45.5 L22 64 Z" fill="${secondary}"/>` +
      `<path d="M59 64 C58 53 50 47.5 41 45.5 L42 64 Z" fill="${secondary}"/>` +
      `</g>`;
  } else if (pattern === 'checkers') {
    const sq = [];
    for (let x = 8; x < 60; x += 6) {
      for (let y = 44; y < 66; y += 6) {
        if (((x + y) / 6) % 2 < 1) {
          sq.push(`<rect x="${x}" y="${y}" width="6" height="6" fill="${secondary}"/>`);
        }
      }
    }
    body += `<g clip-path="url(#torso)">${sq.join('')}</g>`;
  } else if (pattern === 'keeper') {
    // subtle darker shoulder yoke to read as a keeper top
    body += `<g clip-path="url(#torso)"><path d="M5 64 C6 53 14 47.5 23 45.5 L41 45.5 C50 47.5 58 53 59 64 L59 52 L5 52 Z" fill="#000000" opacity="0.18"/></g>`;
  }
  const collarShape = collar
    ? `<path d="M25.5 45.2 Q32 50.4 38.5 45.2 L38.5 48 Q32 53.2 25.5 48 Z" fill="${collar}"/>`
    : '';
  return body + collarShape;
}

// ── Player configs ───────────────────────────────────────────────────────
// key = footballer dataset id; file = filename expected by playerAvatars.ts.
const PLAYERS = {
  'Messi, Lionel': {
    file: 'messi',
    skin: SKIN.light,
    hair: {style: 'crop', color: HAIR.darkBrown},
    beard: {kind: 'short', color: '#4A2E1C'},
    face: {mouth: 'smile'},
    jersey: {pattern: 'stripes', primary: '#FFFFFF', secondary: '#75AADB', collar: '#1C2A4A'},
  },
  'Ronaldo, Cristiano': {
    file: 'cristiano',
    skin: SKIN.tan,
    hair: {style: 'quiff', color: HAIR.black},
    beard: {kind: 'none'},
    face: {mouth: 'grin', browTilt: 4},
    jersey: {pattern: 'solid', primary: '#8E1F2F', collar: '#1E6B4F'},
  },
  'Aubameyang, Pierre-Emerick': {
    file: 'aubameyang',
    skin: SKIN.dark,
    hair: {style: 'blondeTop', color: HAIR.black, accent: HAIR.blonde},
    beard: {kind: 'short', color: HAIR.black},
    face: {mouth: 'grin'},
    jersey: {pattern: 'sleeves', primary: '#DB2B39', secondary: '#F2F2F4', collar: '#F2F2F4'},
  },
  'Courtois, Thibaut': {
    file: 'courtois',
    skin: SKIN.pale,
    hair: {style: 'keeperShort', color: HAIR.darkBrown},
    beard: {kind: 'stubble', color: HAIR.darkBrown},
    face: {mouth: 'neutral'},
    jersey: {pattern: 'keeper', primary: '#1F5E46', collar: '#15161A'},
  },
};

// ── Compose + rasterize ──────────────────────────────────────────────────
function portrait(p) {
  const hairFn = HAIRSTYLES[p.hair.style];
  return wrap(
    `<defs>` +
      `<clipPath id="head"><path d="${HEAD}"/></clipPath>` +
      `<clipPath id="torso"><path d="${TORSO}"/></clipPath>` +
      `</defs>` +
      neck(p.skin) +
      jersey(p.jersey) +
      head(p.skin) +
      ears(p.skin) +
      face(p.skin, p.hair.color, p.face) +
      beard(p.skin, p.beard.color ?? p.hair.color, p.beard.kind) +
      hairFn(p.hair.color, p.hair.accent),
  );
}

mkdirSync(OUT_DIR, {recursive: true});

const entries = Object.entries(PLAYERS);
for (const [id, p] of entries) {
  const svg = portrait(p);
  await sharp(Buffer.from(svg), {density: 384})
    .resize(SIZE, SIZE, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png()
    .toFile(resolve(OUT_DIR, `${p.file}.png`));
}

console.log(`✓ ${entries.length} player portraits → ${OUT_DIR}`);
