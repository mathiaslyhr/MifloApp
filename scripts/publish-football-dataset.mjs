// Publish the game content pack over the air, so data edits reach installed
// apps without an App Store build:
//
//   npm run data:publish            (uploads; needs SUPABASE_SERVICE_ROLE_KEY in .env)
//   npm run data:publish -- --dry-run   (validates + writes the payload locally)
//
// Flow: regenerate the frozen Scout schedule → refuse to publish uncommitted
// data (the repo must record exactly what went live) → run the data test
// suites (unique ids, club refs, flag/crest SOURCE coverage) → rasterize +
// upload any crest/flag/portrait this binary does not bundle so it ships OTA
// (see remoteArt.ts) → build one JSON pack (footballers, clubs, managers,
// trebles, lineups, Scout schedule, Red Card questions + en/da strings, plus
// remoteArt paths) → upload it content-addressed next to a tiny manifest:
//
//   game-data/manifest.json                 {version, path, checksum} — cache 60s
//   game-data/datasets/dataset-<hash>.json  immutable, cached for a year
//
// The dataset file's bytes are purely content-derived (no timestamps), so
// republishing unchanged data is a no-op and "already exists" is safe.
// Clients poll the manifest with If-None-Match (see remote/datasetSync.ts).
import {execSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {root} from './_load-football.mjs';
import {
  flagIso,
  logoSlug,
  rasterizeFlag,
  rasterizeLogo,
  rasterizePortrait,
} from './lib/art.mjs';

const require = createRequire(import.meta.url);
const DRY_RUN = process.argv.includes('--dry-run');
const BUCKET = 'game-data';

const fail = message => {
  console.error(`\ndata:publish — ${message}`);
  process.exit(1);
};

// ---- 1. Regenerate the frozen schedules, then refuse uncommitted data ------
console.log('Regenerating Scout schedule…');
execSync('npm run --silent scout:schedule', {cwd: root, stdio: 'inherit'});
console.log('Regenerating Journeyman schedule…');
execSync('npm run --silent journeyman:schedule', {cwd: root, stdio: 'inherit'});
console.log('Regenerating Top Bins schedule…');
execSync('npm run --silent tenball:schedule', {cwd: root, stdio: 'inherit'});
console.log('Regenerating Team sheet schedule…');
execSync('npm run --silent teamsheet:schedule', {cwd: root, stdio: 'inherit'});

const WATCHED = [
  'src/data/football',
  'src/games/scout/schedule.generated.ts',
  'src/games/journeyman/schedule.generated.ts',
  'src/games/red-card/questions.ts',
  'src/games/tenball/lists.ts',
  'src/games/tenball/schedule.generated.ts',
  'src/games/teamsheet/schedule.generated.ts',
  'src/core/i18n/en.json',
  'src/core/i18n/da.json',
];
if (!DRY_RUN) {
  const dirty = execSync(`git status --porcelain -- ${WATCHED.join(' ')}`, {
    cwd: root,
  })
    .toString()
    .trim();
  if (dirty) {
    fail(
      `uncommitted data changes — commit first so the repo records what went live:\n${dirty}`,
    );
  }
}

// ---- 2. Validate via the data test suites ----------------------------------
console.log('Running data integrity tests…');
try {
  execSync('npx jest src/data/football src/games/scout src/games/journeyman src/games/red-card src/games/tenball src/games/teamsheet --silent', {
    cwd: root,
    stdio: 'inherit',
  });
} catch {
  fail('data tests failed — fix the dataset before publishing.');
}

// ---- 3. Load the dataset (require AFTER the schedule regen above) ----------
const football = require(resolve(root, 'src/data/football/index.ts'));
const {DAILY_SECRETS, POOL_SIGNATURE} = require(
  resolve(root, 'src/games/scout/schedule.generated.ts'),
);
const {hashDateKey} = require(resolve(root, 'src/games/scout/dailySeed.ts'));
const {JOURNEYMAN_SCHEDULE, POOL_SIGNATURE: JOURNEYMAN_POOL_SIGNATURE} = require(
  resolve(root, 'src/games/journeyman/schedule.generated.ts'),
);
const {QUESTION_IDS} = require(resolve(root, 'src/games/red-card/questions.ts'));
const {BUNDLED_LISTS} = require(resolve(root, 'src/games/tenball/lists.ts'));
const {TENBALL_SCHEDULE} = require(
  resolve(root, 'src/games/tenball/schedule.generated.ts'),
);
const {TEAMSHEET_SCHEDULE, POOL_SIGNATURE: TEAMSHEET_POOL_SIGNATURE} = require(
  resolve(root, 'src/games/teamsheet/schedule.generated.ts'),
);
const en = require(resolve(root, 'src/core/i18n/en.json'));
const da = require(resolve(root, 'src/core/i18n/da.json'));

// ---- 4. Cross-reference checks the jest suites don't cover -----------------
const playerIds = new Set(football.FOOTBALLERS.map(f => f.id));
for (const [dateKey, id] of Object.entries(DAILY_SECRETS)) {
  if (!playerIds.has(id)) {
    fail(`Scout schedule ${dateKey} references unknown footballer '${id}'.`);
  }
}
for (const [dateKey, id] of Object.entries(JOURNEYMAN_SCHEDULE)) {
  if (!playerIds.has(id)) {
    fail(`Journeyman schedule ${dateKey} references unknown footballer '${id}'.`);
  }
}
for (const squad of football.TREBLE_SQUADS) {
  for (const id of squad.playerIds) {
    if (!playerIds.has(id)) {
      fail(`treble squad ${squad.clubId} ${squad.season} references unknown '${id}'.`);
    }
  }
}
for (const lineup of football.FAMOUS_LINEUPS) {
  for (const p of lineup.players) {
    if (p.footballerId && !playerIds.has(p.footballerId)) {
      fail(`lineup ${lineup.id} references unknown footballer '${p.footballerId}'.`);
    }
  }
}
const enQuestions = en.redCard?.questions ?? {};
const daQuestions = da.redCard?.questions ?? {};
for (const id of QUESTION_IDS) {
  if (!enQuestions[id]) {
    fail(`Red Card question '${id}' has no English text in en.json.`);
  }
  if (!daQuestions[id]) {
    console.warn(`  warning: Red Card question '${id}' has no Danish text.`);
  }
}
const listIds = new Set(BUNDLED_LISTS.map(l => l.id));
for (const list of BUNDLED_LISTS) {
  for (const entry of list.entries) {
    if (entry.footballerId && !playerIds.has(entry.footballerId)) {
      fail(`tenball list ${list.id} references unknown footballer '${entry.footballerId}'.`);
    }
  }
}
for (const [dateKey, id] of Object.entries(TENBALL_SCHEDULE)) {
  if (!listIds.has(id)) {
    fail(`Top Bins schedule ${dateKey} references unknown list '${id}'.`);
  }
}
const enLists = en.tenball?.lists ?? {};
const daLists = da.tenball?.lists ?? {};
for (const id of listIds) {
  if (!enLists[id]?.title) {
    fail(`Top Bins list '${id}' has no English title in en.json.`);
  }
  if (!daLists[id]?.title) {
    console.warn(`  warning: Top Bins list '${id}' has no Danish title.`);
  }
}
const lineupIds = new Set(football.FAMOUS_LINEUPS.map(l => l.id));
for (const [dateKey, id] of Object.entries(TEAMSHEET_SCHEDULE)) {
  if (!lineupIds.has(id)) {
    fail(`Team sheet schedule ${dateKey} references unknown lineup '${id}'.`);
  }
}
for (const lineup of football.FAMOUS_LINEUPS) {
  const key = lineup.match?.competitionKey;
  if (!key) {
    continue;
  }
  if (!en.teamsheet?.competitions?.[key]) {
    fail(`Team sheet competition key '${key}' (${lineup.id}) has no English text in en.json.`);
  }
  if (!da.teamsheet?.competitions?.[key]) {
    console.warn(`  warning: Team sheet competition key '${key}' has no Danish text.`);
  }
}

// ---- 4b. Resolve OTA art -----------------------------------------------------
// Rasterize + queue any crest / flag / portrait this binary does NOT bundle, so
// a club/nation/portrait added since the last App Store build ships over the air
// (installed apps load it as a remote {uri} — see remoteArt.ts). Art already
// bundled here stays the fast, offline path and is NOT re-uploaded.
const logosDir = resolve(root, 'src/games/hattrick/assets/logos');
const flagsDir = resolve(root, 'src/games/hattrick/assets/flags');
const bundledClubIds = new Set(
  readdirSync(logosDir).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)),
);
const bundledFlagIsos = new Set(
  readdirSync(flagsDir).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)),
);

const remoteArt = {logos: {}, flags: {}, portraits: {}};
const artUploads = []; // [{path, buffer}]
const hash8 = buf => createHash('sha256').update(buf).digest('hex').slice(0, 8);

// Every country a flag can render for (players, clubs, managers).
const referencedCountries = new Set();
for (const f of football.FOOTBALLERS) for (const n of f.nationality) referencedCountries.add(n);
for (const c of football.CLUBS) referencedCountries.add(c.country);
for (const m of football.MANAGERS) {
  for (const n of m.nationality) referencedCountries.add(n);
  for (const s of m.spells) if (s.country) referencedCountries.add(s.country);
}

const isoPath = new Map(); // iso → uploaded path (rasterize each flag once)
for (const country of [...referencedCountries].sort()) {
  const iso = flagIso(country);
  if (!iso) {
    fail(`no flagcdn ISO for '${country}' — add it to scripts/lib/art-sources.js.`);
  }
  if (bundledFlagIsos.has(iso)) {
    continue; // bundled in this binary — fast path, no OTA needed
  }
  if (!isoPath.has(iso)) {
    try {
      const png = await rasterizeFlag(iso);
      const p = `art/flags/${iso}-${hash8(png)}.png`;
      isoPath.set(iso, p);
      artUploads.push({path: p, buffer: png});
      console.log(`  + OTA flag ${country} (${iso}) ${png.length}b`);
    } catch (e) {
      fail(`could not fetch OTA flag for '${country}' (${iso}): ${e.message}`);
    }
  }
  remoteArt.flags[country] = isoPath.get(iso);
}

// validateContentPack requires a crest for EVERY club in the pack.
for (const club of [...football.CLUBS].sort((a, b) => a.id.localeCompare(b.id))) {
  if (bundledClubIds.has(club.id)) {
    continue;
  }
  const slug = logoSlug(club);
  try {
    const png = await rasterizeLogo(slug);
    const p = `art/logos/${club.id}-${hash8(png)}.png`;
    remoteArt.logos[club.id] = p;
    artUploads.push({path: p, buffer: png});
    console.log(`  + OTA crest ${club.id} (${slug}) ${png.length}b`);
  } catch (e) {
    fail(
      `could not fetch OTA crest for '${club.id}' (tried "${slug}"): ${e.message}` +
        ' — add a slug to scripts/lib/art-sources.js.',
    );
  }
}

// Portraits never gate a pack: only what an explicit staging manifest lists
// ships. scripts/staging/portraits.json = {"<footballerId>": "<png path from repo root>"}.
const portraitManifest = resolve(root, 'scripts/staging/portraits.json');
if (existsSync(portraitManifest)) {
  const entries = JSON.parse(readFileSync(portraitManifest, 'utf8'));
  for (const [playerId, rel] of Object.entries(entries)) {
    const file = resolve(root, rel);
    if (!existsSync(file)) {
      console.warn(`  warning: staged portrait for '${playerId}' not at ${rel} — skipped.`);
      continue;
    }
    const png = await rasterizePortrait(readFileSync(file));
    const slug = playerId
      .normalize('NFD')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    const p = `art/portraits/${slug}-${hash8(png)}.png`;
    remoteArt.portraits[playerId] = p;
    artUploads.push({path: p, buffer: png});
    console.log(`  + OTA portrait ${playerId} ${png.length}b`);
  }
}

// Drop empty subsections so a fully-bundled pack stays byte-identical to before
// (unchanged content hash ⇒ "already live / nothing to publish" still holds).
for (const key of Object.keys(remoteArt)) {
  if (Object.keys(remoteArt[key]).length === 0) {
    delete remoteArt[key];
  }
}
const hasRemoteArt = Object.keys(remoteArt).length > 0;
if (artUploads.length) {
  console.log(`OTA art: ${artUploads.length} file(s) not bundled in this binary.`);
}

// ---- 5. Build the content-addressed pack ------------------------------------
const sections = {
  footballers: football.FOOTBALLERS,
  clubs: football.CLUBS,
  managers: football.MANAGERS,
  trebleSquads: football.TREBLE_SQUADS,
  famousLineups: football.FAMOUS_LINEUPS,
  scoutSchedule: {dailySecrets: DAILY_SECRETS, poolSignature: POOL_SIGNATURE},
  journeymanSchedule: {
    dailySecrets: JOURNEYMAN_SCHEDULE,
    poolSignature: JOURNEYMAN_POOL_SIGNATURE,
  },
  redCardQuestions: {
    ids: [...QUESTION_IDS],
    i18n: {en: enQuestions, da: daQuestions},
  },
  tenball: {
    lists: BUNDLED_LISTS,
    schedule: TENBALL_SCHEDULE,
    i18n: {en: {lists: enLists}, da: {lists: daLists}},
  },
  teamsheetSchedule: {
    schedule: TEAMSHEET_SCHEDULE,
    poolSignature: TEAMSHEET_POOL_SIGNATURE,
  },
  ...(hasRemoteArt ? {remoteArt} : {}),
};
const version = createHash('sha256')
  .update(JSON.stringify(sections))
  .digest('hex')
  .slice(0, 16);
const body = JSON.stringify({schemaVersion: 1, version, ...sections});
const checksum = hashDateKey(body);
const path = `datasets/dataset-${version}.json`;
const manifest = JSON.stringify({
  schemaVersion: 1,
  version,
  path,
  checksum,
  generatedAt: new Date().toISOString(),
});

console.log(
  `Pack ${version}: ${football.FOOTBALLERS.length} footballers, ` +
    `${football.CLUBS.length} clubs, ${football.MANAGERS.length} managers, ` +
    `${Object.keys(DAILY_SECRETS).length} scheduled Scout days, ` +
    `${Object.keys(JOURNEYMAN_SCHEDULE).length} Journeyman days, ` +
    `${QUESTION_IDS.length} Red Card questions, ` +
    `${BUNDLED_LISTS.length} Top Bins lists, ` +
    `${Object.keys(TEAMSHEET_SCHEDULE).length} Team sheet days (${(body.length / 1024).toFixed(0)} KB).`,
);

if (DRY_RUN) {
  const out = resolve(tmpdir(), `miflo-dataset-${version}.json`);
  writeFileSync(out, body);
  writeFileSync(resolve(tmpdir(), 'miflo-manifest.json'), manifest);
  if (artUploads.length) {
    console.log(`Would upload ${artUploads.length} OTA art file(s):`);
    for (const a of artUploads) {
      console.log(`  ${a.path} (${a.buffer.length}b)`);
    }
  }
  console.log(`Dry run — wrote ${out} (and miflo-manifest.json). Nothing uploaded.`);
  process.exit(0);
}

// ---- 6. Upload ---------------------------------------------------------------
const {SUPABASE_URL} = require(resolve(root, 'src/core/config.ts'));
const url = process.env.SUPABASE_URL || SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  fail('SUPABASE_SERVICE_ROLE_KEY missing — put it in .env (gitignored).');
}

const {createClient} = await import('@supabase/supabase-js');
const supabase = createClient(url, serviceKey, {auth: {persistSession: false}});
const publicUrl = object =>
  `${url}/storage/v1/object/public/${BUCKET}/${object}`;

const current = await fetch(`${publicUrl('manifest.json')}?v=${Date.now()}`);
if (current.ok) {
  const live = await current.json().catch(() => null);
  if (live?.version === version) {
    console.log(`Version ${version} is already live — nothing to publish.`);
    process.exit(0);
  }
}

// Upload OTA art FIRST — the pack references these paths, so they must exist
// before installed apps fetch the new manifest. Paths are content-hashed, so
// re-uploading identical bytes is a harmless "already exists".
for (const {path: artPath, buffer} of artUploads) {
  console.log(`Uploading ${artPath}…`);
  const up = await supabase.storage.from(BUCKET).upload(artPath, buffer, {
    contentType: 'image/png',
    cacheControl: '31536000',
    upsert: false,
  });
  if (up.error && !/already exists|duplicate/i.test(up.error.message)) {
    fail(`art upload failed (${artPath}): ${up.error.message}`);
  }
}

console.log(`Uploading ${path}…`);
const dataset = await supabase.storage
  .from(BUCKET)
  .upload(path, Buffer.from(body), {
    contentType: 'application/json',
    cacheControl: '31536000',
    upsert: false,
  });
if (dataset.error && !/already exists|duplicate/i.test(dataset.error.message)) {
  fail(`dataset upload failed: ${dataset.error.message}`);
}

console.log('Updating manifest.json…');
const manifestUpload = await supabase.storage
  .from(BUCKET)
  .upload('manifest.json', Buffer.from(manifest), {
    contentType: 'application/json',
    cacheControl: '60',
    upsert: true,
  });
if (manifestUpload.error) {
  fail(`manifest upload failed: ${manifestUpload.error.message}`);
}

// ---- 7. Verify from the public URL -------------------------------------------
const verify = await fetch(`${publicUrl('manifest.json')}?v=${Date.now()}`);
const published = verify.ok ? await verify.json().catch(() => null) : null;
if (published?.version !== version) {
  fail('verification fetch did not return the new manifest — check the bucket.');
}
console.log(
  `\nPublished ${version}. Apps pick it up on next launch/foreground (CDN lag ≤ ~60s).`,
);
