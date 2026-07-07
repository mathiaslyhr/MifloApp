// Download a likeness photo per player from Wikipedia (lead image).
// Photos are ONLY used as generation guidance, never shipped.
//   node fetch-photos.mjs [file ...]   e.g. node fetch-photos.mjs messi cristiano
import {writeFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {PLAYERS, PILOTS} from './players.mjs';

const OUT = resolve(import.meta.dirname, 'photos');
const only = process.argv.slice(2);
const targets = PLAYERS.filter(p =>
  only.length ? only.includes(p.file) : true,
);

const UA = 'MifloPlayerArt/1.0 (personal art pipeline)';

for (const p of targets) {
  const dest = resolve(OUT, `${p.file}.jpg`);
  if (existsSync(dest)) {
    console.log(`· ${p.file} (cached)`);
    continue;
  }
  const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.wiki)}`;
  const res = await fetch(api, {headers: {'User-Agent': UA}});
  if (!res.ok) {
    console.error(`✗ ${p.file}: summary ${res.status}`);
    continue;
  }
  const data = await res.json();
  const url = data.originalimage?.source ?? data.thumbnail?.source;
  if (!url) {
    console.error(`✗ ${p.file}: no lead image on "${p.wiki}"`);
    continue;
  }
  const img = await fetch(url, {headers: {'User-Agent': UA}});
  if (!img.ok) {
    console.error(`✗ ${p.file}: image ${img.status}`);
    continue;
  }
  writeFileSync(dest, Buffer.from(await img.arrayBuffer()));
  console.log(`✓ ${p.file} ← ${url}`);
}
