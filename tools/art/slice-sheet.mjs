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
const ASSETS = resolve(HERE, '../../src/games/hattrick/assets');
const PREVIEW = resolve(HERE, 'preview');

// Layouts use REF_W×REF_H coordinates; crops scale to the actual sheet size.
// Each row: item band [y0..y1] (label text excluded) + column centers.
// `use`: null = every item ships under its own name into `out`; otherwise all
// items land in `extras` and only the mapped ones are copied into `out`.
const SHEETS = {
  // spillere.png — 21 teammate portraits (July 2026).
  players: {
    refW: 1536, refH: 1024, halfW: 122, size: 256, anchor: 'south',
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
  // classics sheet (00ad07e0…, 1536×1024) — the 16 classic hub players, 4×4.
  // Portraits sit very close together: narrow halfW + edge-sliver dropping.
  classics: {
    refW: 1536, refH: 1024, halfW: 135, size: 256, anchor: 'south',
    out: resolve(ASSETS, 'players'),
    extras: null,
    use: null,
    key: 'edge',
    tol: 34,
    rows: [
      {y0: 15, y1: 255, cols: [235, 578, 916, 1265], names: ['zlatan', 'ramos', 'suarez', 'modric']},
      {y0: 298, y1: 514, cols: [235, 578, 916, 1265], names: ['benzema', 'busquets', 'xavi', 'iniesta']},
      {y0: 566, y1: 764, cols: [235, 578, 916, 1265], names: ['lampard', 'gerrard', 'kroos', 'muller']},
      {y0: 814, y1: 990, cols: [235, 578, 916, 1265], names: ['buffon', 'totti', 'pirlo', 'maldini']},
    ],
  },
  // icons sheet (b61bd962…, 1774×887) — 2×6 trophies + generic chip icons.
  // Ships into two asset dirs, so `out` is the assets root with subpaths.
  icons: {
    refW: 1774, refH: 887, halfW: 146, size: 128,
    out: ASSETS,
    extras: resolve(HERE, 'extras/icons'),
    key: 'edge',
    tol: 40,
    holeTol: 26,
    // the silhouette is broader than the grid pitch; islands handle any bleed
    halfWOverride: {teammate: 165},
    use: {
      'europa-league': 'trophies/europa-league.png',
      'domestic-cup': 'trophies/domestic-cup.png',
      'prem-trophy': 'trophies/league-premier-league.png',
      'squad-number': 'criteria/shirt-number.png',
      'position-gk': 'criteria/position-gk.png',
      'position-df': 'criteria/position-df.png',
      'position-mf': 'criteria/position-mf.png',
      'teammate': 'criteria/teammate.png',
      'tag-current-stars': 'criteria/tag-current-stars.png',
    },
    rows: [
      {y0: 20, y1: 378, cols: [148, 444, 739, 1035, 1331, 1627], names: ['europa-league', 'domestic-cup', 'prem-trophy', 'squad-number', 'position-gk', 'position-df']},
      {y0: 515, y1: 775, cols: [148, 444, 739, 1035, 1331, 1627], names: ['position-mf', 'teammate', 'captain', 'tag-current-stars', 'form-boost', 'consistent']},
    ],
  },
  // managers.png (1254×1254) — 16 managers 4×4; no game feature yet, so
  // everything lands in extras/managers/ until the "Managed by X" axis exists.
  managers: {
    refW: 1254, refH: 1254, halfW: 130, size: 256,
    out: resolve(HERE, 'extras/managers'),
    extras: null,
    use: null,
    key: 'edge',
    // darker background than the other sheets — near-black coats (Mourinho,
    // Klopp) sit close to it, so the tolerance must be tight
    tol: 26,
    // Mourinho's tile: shade-varying bg AND green rim-light on the coat share
    // the same color range — no tol separates them. Kept at the base tol
    // (coat intact, faint bg remnants); regenerate his tile solo before the
    // "Managed by X" feature ships.
    tolOverride: {},
    // big labels sit tight under the busts; whatever the bands still catch is
    // disconnected bottom-band text and gets dropped
    dropBottom: 0.78,
    rows: [
      {y0: 31, y1: 272, cols: [173, 468, 761, 1067], names: ['guardiola', 'mourinho', 'ancelotti', 'ferguson']},
      {y0: 341, y1: 585, cols: [173, 468, 761, 1067], names: ['klopp', 'wenger', 'zidane', 'simeone']},
      {y0: 655, y1: 880, cols: [173, 468, 761, 1067], names: ['conte', 'benitez', 'tuchel', 'luisenrique']},
      {y0: 950, y1: 1165, cols: [173, 468, 761, 1067], names: ['delbosque', 'low', 'vangaal', 'capello']},
    ],
  },
  // Generic 4×4 portrait grid — the layout every NEW portrait batch uses
  // (see docs/portrait-batches.md). Same geometry as the classics sheet,
  // which ChatGPT reproduced reliably. Names come from --names in reading
  // order (left→right, top→bottom); output goes to --out (default
  // tools/art/portraits/, the OTA staging area — NOT the bundled assets).
  grid16: {
    // autoGrid: rows/cols are DETECTED from the sheet's ink (ChatGPT never
    // places the grid at exactly the same coordinates twice) — 4 column runs
    // and the 4 tallest row bands become the crop boxes. The rows below are
    // only a fallback shape; detection replaces them.
    refW: 1536, refH: 1024, halfW: 135, size: 256, anchor: 'south',
    out: resolve(HERE, 'portraits'),
    extras: null,
    use: null,
    key: 'edge',
    tol: 34,
    namesFromCli: 16,
    autoGrid: {cols: 4, rows: 4},
    rows: [
      {y0: 15, y1: 255, cols: [235, 578, 916, 1265], names: []},
      {y0: 298, y1: 514, cols: [235, 578, 916, 1265], names: []},
      {y0: 566, y1: 764, cols: [235, 578, 916, 1265], names: []},
      {y0: 814, y1: 990, cols: [235, 578, 916, 1265], names: []},
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
      // user prefers the sheet's "Golden Ball" art for the Ballon d'Or chip;
      // the sheet's own "Ballon d'Or" item stays in extras only
      'golden-ball': 'ballon-dor.png',
      'world-cup-winner': 'world-cup.png',
      'wc-golden-boot': 'golden-boot.png',
      'ucl-winner': 'champions-league.png',
      'laliga-winner': ['league-title.png', 'league-la-liga.png'],
      'prem-winner': 'league-premier-league.png',
      'seriea-winner': 'league-serie-a.png',
      'bundesliga-winner': 'league-bundesliga.png',
      'treble': 'treble.png',
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
const namesArg = process.argv.find(a => a.startsWith('--names='))?.slice(8);
const outArg = process.argv.find(a => a.startsWith('--out='))?.slice(6);
// --y1=name:refY,… hard bottom cuts (skip autoBottom) — for slicing a bust
// off right above a crest/badge the sheet was not supposed to draw.
const y1Arg = process.argv.find(a => a.startsWith('--y1='))?.slice(5);
const cfg = SHEETS[sheetKey];
if (!cfg || !sheetPath) {
  console.error('usage: node slice-sheet.mjs <players|classics|grid16|…> <sheet.png> [--preview] [--names=a,b,…] [--out=dir]');
  process.exit(1);
}
if (cfg.namesFromCli) {
  const names = namesArg?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
  if (names.length !== cfg.namesFromCli && !preview) {
    console.error(`${sheetKey} needs exactly --names=<${cfg.namesFromCli} comma-separated output names in reading order>`);
    process.exit(1);
  }
  let i = 0;
  for (const row of cfg.rows) {
    row.names = names.length
      ? names.slice(i, i + row.cols.length)
      : row.cols.map((_, c) => `cell-${cfg.rows.indexOf(row)}-${c}`);
    i += row.cols.length;
  }
}
if (outArg) {
  cfg.out = resolve(outArg);
}
if (y1Arg) {
  cfg.yOverride = {...cfg.yOverride};
  for (const pair of y1Arg.split(',')) {
    const [name, y] = pair.split(':');
    cfg.yOverride[name.trim()] = Number(y);
  }
}

const {width: W, height: H} = await sharp(sheetPath).metadata();
if (cfg.autoGrid) {
  // Detected coordinates are actual pixels — no ref scaling.
  cfg.refW = W;
  cfg.refH = H;
}
const sx = W / cfg.refW, sy = H / cfg.refH;

// Full-sheet pixels for the auto-headroom pass, bg sampled from the sheet's
// own corners (all sheets use one flat background color).
const sheetRaw = await sharp(sheetPath).ensureAlpha().raw().toBuffer();
const sheetBg = (() => {
  const px = i => [sheetRaw[i * 4], sheetRaw[i * 4 + 1], sheetRaw[i * 4 + 2]];
  const corners = [0, W - 1, (H - 1) * W, H * W - 1].map(px);
  return [0, 1, 2].map(c => corners.reduce((s, p) => s + p[c], 0) / 4);
})();

const isSheetBg = (x, y) => {
  const i = (y * W + x) * 4;
  const dr = sheetRaw[i] - sheetBg[0];
  const dg = sheetRaw[i + 1] - sheetBg[1];
  const db = sheetRaw[i + 2] - sheetBg[2];
  return Math.sqrt(dr * dr + dg * dg + db * db) < cfg.tol;
};

if (cfg.autoGrid) {
  // Find the bust boxes from the ink itself. Columns: contiguous runs of
  // ink-bearing pixel columns (busts are wide; inter-column gutters are
  // clean). Rows: the N tallest ink row-bands are busts — label bands are
  // ~20px and fall out on height.
  const colInk = new Array(W).fill(0);
  const rowInk = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isSheetBg(x, y)) {
        colInk[x]++;
        rowInk[y]++;
      }
    }
  }
  const runs = (arr, min, gapMax) => {
    const out = [];
    let start = -1, gap = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > min) {
        if (start < 0) start = i;
        gap = 0;
      } else if (start >= 0 && ++gap > gapMax) {
        out.push([start, i - gap + 1]);
        start = -1;
      }
    }
    if (start >= 0) out.push([start, arr.length]);
    return out;
  };
  const colRuns = runs(colInk, 15, 12).filter(([a, b]) => b - a > 0.04 * W);
  const rowRuns = runs(rowInk, 8, 3)
    .sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))
    .slice(0, cfg.autoGrid.rows)
    .sort((a, b) => a[0] - b[0]);
  if (colRuns.length !== cfg.autoGrid.cols || rowRuns.length !== cfg.autoGrid.rows) {
    console.error(
      `autoGrid: expected ${cfg.autoGrid.cols}×${cfg.autoGrid.rows} but detected ` +
        `${colRuns.length} columns / ${rowRuns.length} row bands — the sheet's ` +
        'layout is off (merged cells, extra art?). Regenerate the sheet.',
    );
    process.exit(1);
  }
  console.log(
    `autoGrid: columns ${colRuns.map(r => Math.round((r[0] + r[1]) / 2)).join(', ')} · ` +
      `row bands ${rowRuns.map(r => r.join('-')).join(', ')}`,
  );
  // Label bands: short ink runs (printed names are ~20px tall, busts 200+).
  // A bust band can swallow the label above it when a tall head leaves no
  // clean gap — every crop row inside a label band is painted background
  // before keying, so text (and its drop shadow, which can bridge to hair)
  // never reaches the output.
  cfg.labelBands = runs(rowInk, 24, 0).filter(([a, b]) => b - a < 40);
  const flatNames = cfg.rows.flatMap(r => r.names);
  cfg.rows = rowRuns.map(([ry0, ry1], ri) => ({
    // ±2px margin; trim() removes surplus background per cell afterwards.
    y0: Math.max(0, ry0 - 2),
    y1: Math.min(H, ry1 + 2),
    cols: colRuns.map(([cx0, cx1]) => Math.round((cx0 + cx1) / 2)),
    colHalfW: colRuns.map(([cx0, cx1]) => Math.ceil((cx1 - cx0) / 2) + 4),
    names: flatNames.slice(ri * cfg.autoGrid.cols, (ri + 1) * cfg.autoGrid.cols),
    // Bands are content-derived; the climb/extend passes are unnecessary and
    // would walk into the adjacent label bands.
    noAutoY: true,
  }));
}
const rowHasInk = (y, left, cw) => {
  for (let x = left; x < Math.min(left + cw, W); x++) {
    if (!isSheetBg(x, y)) {
      return true;
    }
  }
  return false;
};

/**
 * Walk a crop's top edge upward until one clean background row separates the
 * subject from whatever sits above (the previous row's label). The generated
 * sheets never align hair to the hand-tuned y bands exactly, and a band that
 * starts inside the hair ships a flat-topped portrait — this makes the top
 * edge content-aware so it cannot happen, on this sheet or any future one.
 */
function autoTop(top, left, cw) {
  // Never climb more than ~12% of the sheet: if no clean row shows up by
  // then, the band is misconfigured — keep the hand-tuned value and say so.
  const floor = Math.max(0, top - Math.round(0.12 * H));
  let y = top;
  while (y > floor && rowHasInk(y, left, cw)) {
    y--;
  }
  if (y === floor && rowHasInk(y, left, cw)) {
    console.warn(`  ! no headroom found above y=${top} — keeping the configured band`);
    return top;
  }
  return Math.max(0, y - 2);
}

/**
 * Walk a crop's bottom edge down until one clean background row separates the
 * bust from its printed label. The hand-tuned bands stopped mid-chest, so how
 * much collar survived varied portrait to portrait — this keeps each bust's
 * full drawn extent. No margin is added downward: the first clean row is the
 * boundary, and anything past it is label text.
 */
function autoBottom(bottom, left, cw) {
  // Only walk when the band cuts through a real chest cross-section: busts
  // are wide where they end, label text is not. Without this, a band sitting
  // just above a label walks straight through the letters instead.
  const inkWidth = y => {
    let n = 0;
    for (let x = left; x < Math.min(left + cw, W); x++) {
      if (!isSheetBg(x, y)) {
        n++;
      }
    }
    return n;
  };
  if (inkWidth(bottom) < 0.4 * cw) {
    return bottom;
  }
  const ceilY = Math.min(H - 1, bottom + Math.round(0.12 * H));
  let y = bottom;
  while (y < ceilY && rowHasInk(y, left, cw)) {
    y++;
  }
  if (y === ceilY && rowHasInk(y, left, cw)) {
    console.warn(`  ! no gap found below y=${bottom} — keeping the configured band`);
    return bottom;
  }
  return y;
}

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
    const st = {size: 0, minX: w, maxX: 0, minY: h, maxY: 0};
    const q = [start];
    comp[start] = id;
    while (q.length) {
      const i = q.pop();
      st.size++;
      const x = i % w, y = (i / w) | 0;
      st.minX = Math.min(st.minX, x);
      st.maxX = Math.max(st.maxX, x);
      st.minY = Math.min(st.minY, y);
      st.maxY = Math.max(st.maxY, y);
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
    // Disconnected shapes confined to the crop's top band are stray label
    // text from the row above ("E R" fragments over a head) — a bust never
    // has meaningful parts floating up there.
    const topText = st.maxY <= h * 0.2 && st.size < largest * 0.1;
    return edgeSliver || bottomText || topText || st.size < largest * 0.03;
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
    const halfW = row.colHalfW?.[c] ?? cfg.halfWOverride?.[name] ?? cfg.halfW;
    const left = Math.max(0, Math.round((row.cols[c] - halfW) * sx));
    const cw = Math.min(Math.round(halfW * 2 * sx), W - left);
    const bandTop = Math.round(row.y0 * sy);
    const top = row.noAutoY ? bandTop : autoTop(bandTop, left, cw);
    if (top < bandTop) {
      console.log(`  ${name}: top raised ${bandTop - top}px for full headroom`);
    }
    // A yOverride is a hard cut (label touching the artwork) — never walk it.
    const hardY1 = cfg.yOverride?.[name];
    const bandBottom = Math.round((hardY1 ?? row.y1) * sy);
    const bottom =
      hardY1 != null || row.noAutoY ? bandBottom : autoBottom(bandBottom, left, cw);
    if (bottom > bandBottom) {
      console.log(`  ${name}: bottom extended ${bottom - bandBottom}px for the full collar`);
    }
    const ch = bottom - top;
    const crop = sharp(sheetPath).extract({left, top, width: cw, height: ch});

    if (preview) {
      await crop.png().toFile(resolve(PREVIEW, `${name}.png`));
    } else {
      const {data, info} = await crop.ensureAlpha().raw().toBuffer({resolveWithObject: true});
      for (const [ly0, ly1] of cfg.labelBands ?? []) {
        for (let y = Math.max(ly0 - top, 0); y < Math.min(ly1 - top + 1, info.height); y++) {
          for (let x = 0; x < info.width; x++) {
            const i = (y * info.width + x) * 4;
            data[i] = sheetBg[0];
            data[i + 1] = sheetBg[1];
            data[i + 2] = sheetBg[2];
          }
        }
      }
      keyBackground(data, info.width, info.height, {
        ...cfg,
        tol: cfg.tolOverride?.[name] ?? cfg.tol,
      });
      const dest = resolve(baseOut, `${name}.png`);
      await sharp(data, {raw: {width: info.width, height: info.height, channels: 4}})
        .trim()
        .resize(cfg.size, cfg.size, {
          fit: 'contain',
          // Portraits sit flush with the bottom edge (football-card style) so
          // the bust's painted cut reads as framed, never floating mid-air.
          position: cfg.anchor ?? 'centre',
          background: {r: 0, g: 0, b: 0, alpha: 0},
        })
        .png()
        .toFile(dest);
      // Dome check: a rounded head starts narrow at its apex. A wide topmost
      // row means the crop (or the sheet itself) cut the hair flat — never
      // ship that silently.
      {
        const {data: out, info: oi} = await sharp(dest).ensureAlpha().raw().toBuffer({resolveWithObject: true});
        const rowW = y => {
          let n = 0;
          for (let x = 0; x < oi.width; x++) {
            if (out[(y * oi.width + x) * 4 + 3] > 128) n++;
          }
          return n;
        };
        let top = -1, max = 0;
        for (let y = 0; y < oi.height; y++) {
          const n = rowW(y);
          if (n > 0 && top < 0) top = y;
          max = Math.max(max, n);
        }
        if (top >= 0 && rowW(top) / max > 0.3) {
          console.warn(`  ! ${name}: flat-topped (apex ${rowW(top)}/${max}px) — head may be clipped, check the sheet/crop`);
        }
      }
      const shipAs = cfg.use === null ? [] : [cfg.use[name] ?? []].flat();
      for (const target of shipAs) {
        copyFileSync(dest, resolve(cfg.out, target));
        shipped++;
      }
    }
    count++;
  }
}
console.log(`✓ ${count} items → ${baseOut}${shipped ? ` (${shipped} shipped to ${cfg.out})` : ''}`);
