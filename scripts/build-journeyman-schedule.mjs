// Generate/extend the frozen Journeyman daily schedule (schedule.generated.ts).
//
// The schedule is the single source of truth for "which footballer is the
// secret on day X": an explicit dateKey -> footballer id map committed to the
// repo. Rolling freeze: every date up to today+FREEZE_DAYS is permanent (a
// day a user may have played or is about to play NEVER moves), while dates
// beyond the buffer are reshuffled whenever the daily pool changes, so newly
// added players enter the rotation within the buffer instead of waiting for
// the horizon. When the pool is unchanged the whole file is kept verbatim and
// only missing horizon days are appended. Runs automatically from the
// pre-commit hook; manual run:
//
//   npm run journeyman:schedule
//
// Assignment: seeded Fisher–Yates permutations of the current journeyman pool
// (Scout's fairness pool with a 3+ club-spell floor), walked one player per
// day, skipping anyone scheduled in the previous RECENT_WINDOW days so a
// player never repeats across any seam — and skipping Scout's secret for the
// same date so one player never fronts two dailies at once. The runtime walk
// fallback (post-horizon dates only) cannot enforce either rule.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {FOOTBALLERS, root} from './_load-football.mjs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {hashDateKey, seededRng} = require(resolve(root, 'src/games/scout/dailySeed.ts'));
const {journeymanPool} = require(resolve(root, 'src/games/journeyman/dailySeed.ts'));
const {DAILY_SECRETS} = require(resolve(root, 'src/games/scout/schedule.generated.ts'));
const {shuffle} = require(resolve(root, 'src/data/football/repository.ts'));

const OUT = resolve(root, 'src/games/journeyman/schedule.generated.ts');
const EPOCH_KEY = '2026-07-01';
/** How far past today the schedule must reach (days). */
const HORIZON_DAYS = 730;
/** A scheduled player cannot reappear within this many days. */
const RECENT_WINDOW = 240;
/**
 * Days ahead of today that stay frozen even when the pool changes. Generous on
 * purpose: two phones only share "today's player" when their bundled schedules
 * agree, so the freeze must outlast realistic update lag between TestFlight/
 * App Store builds.
 */
const FREEZE_DAYS = 60;

const dateKeyFor = date => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const nextDateKey = key => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12); // noon dodges DST edges
  date.setDate(date.getDate() + 1);
  return dateKeyFor(date);
};

// ---- Load current state ----------------------------------------------------
const validIds = new Set(FOOTBALLERS.map(f => f.id));
const existing = new Map();
let previousSignature;
if (existsSync(OUT)) {
  const source = readFileSync(OUT, 'utf8');
  previousSignature = Number(source.match(/POOL_SIGNATURE = (\d+)/)?.[1]);
  for (const line of source.split('\n')) {
    const m = line.match(/^  '(\d{4}-\d{2}-\d{2})': '((?:[^'\\]|\\.)*)',$/);
    if (m) {
      existing.set(m[1], m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
    }
  }
}

const horizon = new Date();
horizon.setDate(horizon.getDate() + HORIZON_DAYS);
const horizonKey = dateKeyFor(horizon);

const allDates = [];
for (let key = EPOCH_KEY; key <= horizonKey; key = nextDateKey(key)) {
  allDates.push(key);
}

// ---- Deterministic id stream for new dates ---------------------------------
const poolIds = journeymanPool(FOOTBALLERS).map(f => f.id);
if (poolIds.length <= RECENT_WINDOW) {
  throw new Error(
    `journeyman pool (${poolIds.length}) must exceed RECENT_WINDOW (${RECENT_WINDOW}) — ` +
      'lower RECENT_WINDOW or add players with 3+ club spells',
  );
}
// Fingerprint of the pool. Unchanged pool = keep every existing date verbatim
// (append-only); changed pool = reshuffle everything beyond the freeze buffer
// so new players enter the rotation within FREEZE_DAYS.
const signature = hashDateKey([...poolIds].sort().join('|'));
const poolChanged = previousSignature !== signature;
const freezeEnd = new Date();
freezeEnd.setDate(freezeEnd.getDate() + FREEZE_DAYS);
const freezeEndKey = dateKeyFor(freezeEnd);
// Seed anchored to the first date this run generates, so rerunning on the
// same day is idempotent; the committed output is the source of truth anyway.
const anchor = poolChanged
  ? nextDateKey(freezeEndKey)
  : allDates.find(k => !validIds.has(existing.get(k) ?? '')) ?? horizonKey;
let cycle = 0;
let perm = [];
let permIdx = 0;
function nextFreshId(recentSet, scoutId) {
  for (;;) {
    while (permIdx < perm.length) {
      const id = perm[permIdx++];
      if (!recentSet.has(id) && id !== scoutId) {
        return id;
      }
    }
    perm = shuffle(poolIds, seededRng(hashDateKey(`journeyman-schedule#${anchor}#${cycle++}`)));
    permIdx = 0;
  }
}

// ---- Assemble: keep frozen entries verbatim, regenerate the rest -----------
const schedule = new Map();
const recentQueue = [];
const recentSet = new Set();
const remember = id => {
  recentQueue.push(id);
  recentSet.add(id);
  if (recentQueue.length > RECENT_WINDOW) {
    recentSet.delete(recentQueue.shift());
  }
};

let kept = 0;
let added = 0;
let replaced = 0;
let reshuffled = 0;
for (const key of allDates) {
  const current = existing.get(key);
  const frozen = key <= freezeEndKey || !poolChanged;
  if (current !== undefined && validIds.has(current) && frozen) {
    schedule.set(key, current);
    remember(current);
    kept++;
    continue;
  }
  if (current === undefined) {
    added++;
  } else if (!validIds.has(current)) {
    console.warn(`⚠ ${key}: '${current}' no longer exists in the dataset — reassigning`);
    replaced++;
  } else {
    reshuffled++;
  }
  const id = nextFreshId(recentSet, DAILY_SECRETS[key]);
  schedule.set(key, id);
  remember(id);
}

// ---- Write ------------------------------------------------------------------
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const lines = [...schedule.entries()].map(([k, id]) => `  '${k}': '${esc(id)}',`);
writeFileSync(
  OUT,
  `/**
 * AUTO-GENERATED by scripts/build-journeyman-schedule.mjs — do not edit by hand.
 *
 * The frozen Journeyman daily schedule: dateKey -> secret footballer id. This
 * file (and the OTA pack copy of it) is the source of truth for the day's
 * player, so every user on any app version sees the same career path. Rolling
 * freeze: past days and the near future never change; days beyond the freeze
 * reshuffle when the daily pool changes so new players enter the rotation
 * quickly. Regenerated automatically by the pre-commit hook (or manually via
 * \`npm run journeyman:schedule\`).
 */

/** Fingerprint of the daily pool at generation time — guarded by schedule.test.ts. */
export const POOL_SIGNATURE = ${signature};

export const JOURNEYMAN_SCHEDULE: Record<string, string> = {
${lines.join('\n')}
};
`,
);
console.log(
  `✓ ${schedule.size} days (${EPOCH_KEY} → ${horizonKey}) — kept ${kept}, added ${added}, ` +
    `reshuffled ${reshuffled}${replaced ? `, replaced ${replaced}` : ''}` +
    `${poolChanged ? ` (pool ${poolIds.length}; changed; frozen through ${freezeEndKey})` : ` (pool ${poolIds.length}; unchanged)`}`,
);
