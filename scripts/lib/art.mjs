// Shared art rasterizer: fetch a real flag / crest SVG and turn it into the
// small PNG the app renders. Used by build-flag-assets / build-logo-assets (which
// write the bundled require-maps) AND by publish-football-dataset (which uploads
// not-yet-bundled art to Supabase for over-the-air delivery). Pulls `sharp` +
// `fetch`, so — unlike ./art-sources.js — it is NOT importable from jest.
import sharp from 'sharp';
import art from './art-sources.js';
const {COUNTRY_ISO, CLUB_SLUG, slugify} = art;

export const FLAG_WIDTH = 120; // ~3x of the ~22–40pt flag chip; height follows aspect.
export const LOGO_SIZE = 96; // ~3x of the ~28–32pt crest chip; crest fits inside, square.

const FLAG_BUCKET = 'https://flagcdn.com';
const LOGO_BUCKET = 'https://pub-3bd35431294c47068cbf31a95d572166.r2.dev/logos';

/** flagcdn ISO code for a dataset country name, or undefined. */
export const flagIso = country => COUNTRY_ISO[country];

/** footylogos slug for a club (explicit map, else a slugified name). */
export const logoSlug = club => CLUB_SLUG[club.id] ?? slugify(club.name);

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Fetch + rasterize a country flag to a PNG buffer. */
export async function rasterizeFlag(iso) {
  const svg = await fetchBuffer(`${FLAG_BUCKET}/${iso}.svg`);
  return sharp(svg, {density: 300})
    .resize({width: FLAG_WIDTH})
    .png({compressionLevel: 9})
    .toBuffer();
}

/** Normalize a supplied portrait PNG into the same transparent square box. */
export async function rasterizePortrait(buf) {
  return sharp(buf, {limitInputPixels: false})
    .resize(LOGO_SIZE, LOGO_SIZE, {
      fit: 'contain',
      background: {r: 0, g: 0, b: 0, alpha: 0},
    })
    .png({compressionLevel: 9})
    .toBuffer();
}

/** Fetch + rasterize a club crest to a transparent square PNG buffer. */
export async function rasterizeLogo(slug) {
  const svg = await fetchBuffer(
    `${LOGO_BUCKET}/${slug}/${slug}-logo-footylogos.svg`,
  );
  // Fit the crest inside a transparent square so every badge occupies the same
  // box regardless of its native aspect ratio.
  return sharp(svg, {density: 300, limitInputPixels: false})
    .resize(LOGO_SIZE, LOGO_SIZE, {
      fit: 'contain',
      background: {r: 0, g: 0, b: 0, alpha: 0},
    })
    .png({compressionLevel: 9})
    .toBuffer();
}
