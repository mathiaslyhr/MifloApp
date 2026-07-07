// Turn raw generations (portrait on solid magenta) into app assets:
// chroma-key the magenta to transparency, despill edges, trim, pad square,
// resize to 256px and write into the app's players asset dir.
//
//   node postprocess.mjs [file ...]
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';

const HERE = import.meta.dirname;
const RAW = resolve(HERE, 'raw');
const OUT = resolve(HERE, '../../src/games/tic-tac-toe/assets/players');
const SIZE = 256;

const only = process.argv.slice(2);
const files = readdirSync(RAW)
  .filter(f => f.endsWith('.png'))
  .filter(f => (only.length ? only.includes(f.replace('.png', '')) : true));

const isMagenta = (r, g, b) => r > 150 && b > 150 && g < 110 && r - g > 70 && b - g > 70;

for (const f of files) {
  const src = sharp(resolve(RAW, f));
  const {data, info} = await src
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (isMagenta(r, g, b)) {
      data[i + 3] = 0;
    } else if (r - g > 40 && b - g > 40 && r > 120 && b > 120) {
      // despill: near-magenta fringe → fade + neutralize the cast
      const m = Math.min(r, b);
      data[i] = Math.round((r + m) / 2);
      data[i + 2] = Math.round((b + m) / 2);
      data[i + 3] = Math.round(data[i + 3] * 0.5);
    }
  }

  await sharp(data, {raw: {width: info.width, height: info.height, channels: 4}})
    .trim()
    .resize(SIZE, SIZE, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png()
    .toFile(resolve(OUT, f));
  console.log(`✓ ${f}`);
}
console.log(`→ ${OUT}`);
