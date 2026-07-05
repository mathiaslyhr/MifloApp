// Re-sort the FOOTBALLERS array in footballers.ts alphabetically by `id`,
// preserving each entry's exact text. Lets new players be appended in bulk and
// then ordered in one pass. Idempotent.
//
//   node scripts/sort-footballers.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'src/data/football/footballers.ts');
const src = readFileSync(file, 'utf8');

const START = '= [\n';
const END = '\n];';
const startIdx = src.indexOf(START) + START.length;
const endIdx = src.lastIndexOf(END);
const head = src.slice(0, startIdx);
const body = src.slice(startIdx, endIdx);
const foot = src.slice(endIdx);

// Each entry is a 2-space-indented object ending at a 2-space `},`.
const blocks = body.match(/ {2}\{\n[\s\S]*?\n {2}\},/g) ?? [];

const idOf = block => {
  const m = block.match(/^ {4}id: '((?:[^'\\]|\\.)*)'/m);
  if (!m) throw new Error('entry without id:\n' + block.slice(0, 80));
  return m[1];
};

const seen = new Set();
for (const b of blocks) {
  const id = idOf(b);
  if (seen.has(id)) throw new Error(`duplicate id: ${id}`);
  seen.add(id);
}

const sorted = [...blocks].sort((a, b) =>
  idOf(a).localeCompare(idOf(b), 'en', {sensitivity: 'base'}),
);

writeFileSync(file, head + sorted.join('\n') + foot);
console.log(`✓ sorted ${sorted.length} footballers`);
