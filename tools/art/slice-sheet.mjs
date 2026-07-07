// Slice ChatGPT-generated illustration sheets (flat green bg, labels printed
// under each item) into individual transparent PNGs for the app.
//
//   node slice-sheet.mjs players  <sheet.png> [--preview]
//   node slice-sheet.mjs trophies <sheet.png> [--preview]
//
// --preview: crop boxes only (no keying/trim), written to preview/ for
// checking a sheet's layout before committing to assets.
//
// Background removal is an edge-connected flood fill: only pixels similar to
// the sampled background color AND reachable from the crop border are
// cleared — interior greens (Courtois' keeper shirt) are safe even if close
// in color. Stray islands (a neighbour bleeding into the crop) are dropped by
// keeping only the largest connected opaque shape.
import {mkdirSync, copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';

const HERE = import.meta.dirname;
const ASSETS = resolve(HERE, '../../src/games/tic-tac-toe/assets');
const PREVIEW = resolve(HERE, 'preview');

// Layouts use REF_W×REF_H coordinates; crops scale to the actual sheet size.
// Each row: item band [y0..y1] (label text excluded) + column centers.
// `use`: null = every item ships under its own name into `out`; otherwise all
// items land in `extras` and only the mapped ones are copied into `out`.
const SHEETS = {
  // spillere.png — 21 teammate portraits (July 2026).
  players: {
    refW: 1536, refH: 1024, halfW: 122, size: 256,
    out: resolve(ASSETS, 'players'),
    extras: null,
    use: null,
    // edge-connected only + tight tolerance: kit greens (Courtois' keeper
    // shirt, Hakimi's trim) sit close to the background green
    key: 'edge',
    tol: 34,
    rows: [
      {y0: 10, y1: 243, cols: [220, 505, 775, 1043, 1324], names: ['messi', 'cristiano', 'neymar', 'debruyne', 'lewandowski']},
      {y0: 285, y1: 497, cols: [170, 423, 665, 913, 1148, 1370], names: ['cancelo', 'lukaku', 'kovacic', 'sterling', 'dimaria', 'felix']},
      {y0: 532, y1: 735, cols: [192, 487, 774, 1039, 1307], names: ['gundogan', 'aubameyang', 'courtois', 'alexis', 'thiagosilva']},
      {y0: 788, y1: 952, cols: [220, 492, 763, 1026, 1304], names: ['fabregas', 'pogba', 'hakimi', 'rudiger', 'walker']},
    ],
  },
  // trophies.png — 23 trophies; only 8 map onto the game's HonourType set,
  // the rest land in extras/ for future honour kinds.
  trophies: {
    refW: 1536, refH: 1024, halfW: 108, size: 128,
    out: resolve(ASSETS, 'trophies'),
    extras: resolve(HERE, 'extras/trophies'),
    // edge fill + tight-tolerance hole pass: enclosed handle/ribbon holes are
    // the EXACT background green, while the AI bakes green reflections into
    // dark plinths — a loose global key eats those (speckled plinths)
    key: 'edge',
    tol: 40,
    holeTol: 26,
    // crops include the printed labels; anything disconnected in the bottom
    // band is label text (plinths are connected to the trophy and survive)
    dropBottom: 0.7,
    // items whose label sits so close it touches the artwork get a hard cut
    yOverride: {'wc-golden-boot': 230, 'laliga-winner': 478},
    use: {
      'ballon-dor-raw': 'ballon-dor.png',
      'world-cup-winner': 'world-cup.png',
      'wc-golden-boot': 'golden-boot.png',
      'ucl-winner': 'champions-league.png',
      'laliga-winner': 'league-title.png',
      'copa-america-winner': 'copa-america.png',
      'euro-winner': 'european-championship.png',
      'player-of-tournament': 'player-of-the-season.png',
    },
    // y-bands include the printed labels on purpose: the label text is
    // disconnected from the trophy, so the largest-component filter drops it.
    rows: [
      {y0: 15, y1: 285, cols: [172, 448, 722, 990, 1268], names: ['ballon-dor-raw', 'world-cup-winner', 'wc-golden-boot', 'ucl-winner', 'ucl-golden-boot']},
      {y0: 288, y1: 545, cols: [152, 397, 655, 900, 1140, 1382], names: ['prem-winner', 'prem-golden-boot', 'laliga-winner', 'laliga-golden-boot', 'seriea-winner', 'seriea-golden-boot']},
      {y0: 548, y1: 790, cols: [172, 442, 668, 915, 1148, 1392], names: ['treble', 'copa-america-winner', 'bundesliga-winner', 'bundesliga-golden-boot', 'golden-boy', 'euro-winner']},
      {y0: 792, y1: 1020, cols: [155, 383, 630, 880, 1130, 1380], names: ['club-world-cup', 'uefa-super-cup', 'golden-glove', 'golden-ball', 'player-of-tournament', 'invincible']},
    ],
  },
};

const [, , sheetKey, sheetPath] = process.argv;
const preview = process.argv.includes('--preview');
const cfg = SHEETS[sheetKey];
if (!cfg || !sheetPath) {
  console.error('usage: node slice-sheet.mjs <players|trophies> <sheet.png> [--preview]');
  process.exit(1);
}

const {width: W, height: H} = await sharp(sheetPath).metadata();
const sx = W / cfg.refW, sy = H / cfg.refH;

function keyBackground(data, w, h, {tol, holeTol, dropBottom}) {
  // Sample bg from the 4 corners (average).
  const px = i => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map(px);
  const bg = [0, 1, 2].map(c => corners.reduce((s, p) => s + p[c], 0) / 4);
  const isBg = i => {
    const dr = data[i * 4] - bg[0], dg = data[i * 4 + 1] - bg[1], db = data[i * 4 + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db) < tol;
  };
  const visited = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    if (visited[i] || !isBg(i)) {
      continue;
    }
    visited[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  if (holeTol != null) {
    // Clear enclosed pockets (cup handles, ribbon gaps) — but only pixels at
    // near-exact background color, so baked-in reflections survive.
    const dist = i => {
      const dr = data[i * 4] - bg[0], dg = data[i * 4 + 1] - bg[1], db = data[i * 4 + 2] - bg[2];
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };
    for (let i = 0; i < w * h; i++) {
      if (!visited[i] && dist(i) < holeTol) {
        visited[i] = 1;
        data[i * 4 + 3] = 0;
      }
    }
  }
  // Soften the cut edge: pixels adjacent to cleared bg get half alpha.
  const cleared = i => visited[i] === 1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!cleared(i) && (cleared(i - 1) || cleared(i + 1) || cleared(i - w) || cleared(i + w))) {
        data[i * 4 + 3] = 128;
      }
    }
  }
  // Drop stray islands — neighbours bleeding in at the crop edges and label
  // text — but NEVER large central shapes: if keying split the subject (a
  // kit-green trim line can cut a shirt in two), both halves must survive.
  const comp = new Int32Array(w * h).fill(-1);
  const stats = []; // {size, minX, maxX, minY}
  for (let start = 0; start < w * h; start++) {
    if (comp[start] !== -1 || data[start * 4 + 3] === 0) {
      continue;
    }
    const id = stats.length;
    const st = {size: 0, minX: w, maxX: 0, minY: h};
    const q = [start];
    comp[start] = id;
    while (q.length) {
      const i = q.pop();
      st.size++;
      const x = i % w, y = (i / w) | 0;
      st.minX = Math.min(st.minX, x);
      st.maxX = Math.max(st.maxX, x);
      st.minY = Math.min(st.minY, y);
      for (const n of [x > 0 && i - 1, x < w - 1 && i + 1, y > 0 && i - w, y < h - 1 && i + w]) {
        if (n !== false && comp[n] === -1 && data[n * 4 + 3] > 0) {
          comp[n] = id;
          q.push(n);
        }
      }
    }
    stats.push(st);
  }
  const largest = Math.max(...stats.map(s => s.size));
  const drop = stats.map(st => {
    if (st.size === largest) {
      return false;
    }
    const edgeSliver = st.maxX <= w * 0.12 || st.minX >= w * 0.88;
    const bottomText = dropBottom != null && st.minY >= h * dropBottom;
    return edgeSliver || bottomText || st.size < largest * 0.03;
  });
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] > 0 && drop[comp[i]]) {
      data[i * 4 + 3] = 0;
    }
  }
}

const baseOut = preview ? PREVIEW : cfg.extras ?? cfg.out;
mkdirSync(baseOut, {recursive: true});
if (!preview && cfg.extras) {
  mkdirSync(cfg.out, {recursive: true});
}

let count = 0, shipped = 0;
for (const row of cfg.rows) {
  for (let c = 0; c < row.cols.length; c++) {
    const name = row.names[c];
    const left = Math.max(0, Math.round((row.cols[c] - cfg.halfW) * sx));
    const top = Math.round(row.y0 * sy);
    const cw = Math.min(Math.round(cfg.halfW * 2 * sx), W - left);
    const y1 = cfg.yOverride?.[name] ?? row.y1;
    const ch = Math.round((y1 - row.y0) * sy);
    const crop = sharp(sheetPath).extract({left, top, width: cw, height: ch});

    if (preview) {
      await crop.png().toFile(resolve(PREVIEW, `${name}.png`));
    } else {
      const {data, info} = await crop.ensureAlpha().raw().toBuffer({resolveWithObject: true});
      keyBackground(data, info.width, info.height, cfg);
      const dest = resolve(baseOut, `${name}.png`);
      await sharp(data, {raw: {width: info.width, height: info.height, channels: 4}})
        .trim()
        .resize(cfg.size, cfg.size, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
        .png()
        .toFile(dest);
      const shipAs = cfg.use === null ? null : cfg.use[name];
      if (cfg.extras && shipAs) {
        copyFileSync(dest, resolve(cfg.out, shipAs));
        shipped++;
      }
    }
    count++;
  }
}
console.log(`✓ ${count} items → ${baseOut}${shipped ? ` (${shipped} shipped to ${cfg.out})` : ''}`);
