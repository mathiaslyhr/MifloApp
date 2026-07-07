// Crop the style-reference screenshots (from ~/Desktop/Player:manager art/)
// down to just the portrait — the "PLAYED WITH ..." text band would otherwise
// leak into generations. Writes refs/ref-N.png.
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';

const SRC = '/Users/mathiaslyhr/Desktop/Player:manager art';
const OUT = resolve(import.meta.dirname, 'refs');

// A diverse subset: different hair, face shapes, jerseys.
const PICKS = [
  'Skærmbillede 2026-07-07 kl. 14.15.44.png', // C. Ronaldo
  'Skærmbillede 2026-07-07 kl. 14.16.09.png', // Di María
  'Skærmbillede 2026-07-07 kl. 14.17.43.png', // Robben (bald)
  'Skærmbillede 2026-07-07 kl. 14.17.57.png', // Ibrahimović
];

const files = readdirSync(SRC);
let n = 0;
for (const pick of PICKS) {
  if (!files.includes(pick)) {
    console.warn(`missing: ${pick}`);
    continue;
  }
  const img = sharp(resolve(SRC, pick));
  const {width, height} = await img.metadata();
  const h = Math.round(height * 0.62); // portrait only, text band removed
  await img
    .extract({left: 0, top: 0, width, height: h})
    .png()
    .toFile(resolve(OUT, `ref-${++n}.png`));
}
console.log(`✓ ${n} style refs → ${OUT}`);
