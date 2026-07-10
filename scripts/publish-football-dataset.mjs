// Publish the game content pack over the air, so data edits reach installed
// apps without an App Store build:
//
//   npm run data:publish            (uploads; needs SUPABASE_SERVICE_ROLE_KEY in .env)
//   npm run data:publish -- --dry-run   (validates + writes the payload locally)
//
// Flow: regenerate the frozen Scout schedule → refuse to publish uncommitted
// data (the repo must record exactly what went live) → run the data test
// suites (unique ids, club refs, flag/crest coverage — the hard gate that
// keeps packs renderable on old binaries) → build one JSON pack (footballers,
// clubs, managers, trebles, lineups, Scout schedule, Red Card questions +
// en/da strings) → upload it content-addressed next to a tiny manifest:
//
//   game-data/manifest.json                 {version, path, checksum} — cache 60s
//   game-data/datasets/dataset-<hash>.json  immutable, cached for a year
//
// The dataset file's bytes are purely content-derived (no timestamps), so
// republishing unchanged data is a no-op and "already exists" is safe.
// Clients poll the manifest with If-None-Match (see remote/datasetSync.ts).
import {execSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {root} from './_load-football.mjs';

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
console.log('Regenerating Top Bins schedule…');
execSync('npm run --silent tenball:schedule', {cwd: root, stdio: 'inherit'});

const WATCHED = [
  'src/data/football',
  'src/games/scout/schedule.generated.ts',
  'src/games/red-card/questions.ts',
  'src/games/tenball/lists.ts',
  'src/games/tenball/schedule.generated.ts',
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
  execSync('npx jest src/data/football src/games/scout src/games/red-card src/games/tenball --silent', {
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
const {QUESTION_IDS} = require(resolve(root, 'src/games/red-card/questions.ts'));
const {BUNDLED_LISTS} = require(resolve(root, 'src/games/tenball/lists.ts'));
const {TENBALL_SCHEDULE} = require(
  resolve(root, 'src/games/tenball/schedule.generated.ts'),
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

// ---- 5. Build the content-addressed pack ------------------------------------
const sections = {
  footballers: football.FOOTBALLERS,
  clubs: football.CLUBS,
  managers: football.MANAGERS,
  trebleSquads: football.TREBLE_SQUADS,
  famousLineups: football.FAMOUS_LINEUPS,
  scoutSchedule: {dailySecrets: DAILY_SECRETS, poolSignature: POOL_SIGNATURE},
  redCardQuestions: {
    ids: [...QUESTION_IDS],
    i18n: {en: enQuestions, da: daQuestions},
  },
  tenball: {
    lists: BUNDLED_LISTS,
    schedule: TENBALL_SCHEDULE,
    i18n: {en: {lists: enLists}, da: {lists: daLists}},
  },
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
    `${Object.keys(DAILY_SECRETS).length} scheduled days, ` +
    `${QUESTION_IDS.length} Red Card questions, ` +
    `${BUNDLED_LISTS.length} Top Bins lists (${(body.length / 1024).toFixed(0)} KB).`,
);

if (DRY_RUN) {
  const out = resolve(tmpdir(), `miflo-dataset-${version}.json`);
  writeFileSync(out, body);
  writeFileSync(resolve(tmpdir(), 'miflo-manifest.json'), manifest);
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
