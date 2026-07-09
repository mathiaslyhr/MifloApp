// Generate/extend the frozen Scout daily schedule (schedule.generated.ts).
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
//   npm run scout:schedule
//
// Assignment: seeded Fisher–Yates permutations of the current daily pool,
// walked one player per day, skipping anyone scheduled in the previous
// RECENT_WINDOW days so a player never repeats across any seam.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {FOOTBALLERS, root} from './_load-football.mjs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {dailyPool, hashDateKey, seededRng} = require(resolve(root, 'src/games/scout/dailySeed.ts'));
const {shuffle} = require(resolve(root, 'src/data/football/repository.ts'));

const OUT = resolve(root, 'src/games/scout/schedule.generated.ts');
const EPOCH_KEY = '2026-01-01';
/** How far past today the schedule must reach (days). */
const HORIZON_DAYS = 730;
/** A scheduled player cannot reappear within this many days. */
const RECENT_WINDOW = 300;
/**
 * Days ahead of today that stay frozen even when the pool changes. Generous on
 * purpose: two phones only share "today's player" when their bundled schedules
 * agree, so the freeze must outlast realistic update lag between TestFlight/
 * App Store builds (14 days proved too short — mixed builds diverged).
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
const poolIds = dailyPool(FOOTBALLERS).map(f => f.id);
if (poolIds.length <= RECENT_WINDOW) {
  throw new Error(`daily pool (${poolIds.length}) must exceed RECENT_WINDOW (${RECENT_WINDOW})`);
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
function nextFreshId(recentSet) {
  for (;;) {
    while (permIdx < perm.length) {
      const id = perm[permIdx++];
      if (!recentSet.has(id)) {
        return id;
      }
    }
    perm = shuffle(poolIds, seededRng(hashDateKey(`schedule#${anchor}#${cycle++}`)));
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
  const id = nextFreshId(recentSet);
  schedule.set(key, id);
  remember(id);
}

// ---- Write ------------------------------------------------------------------
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const lines = [...schedule.entries()].map(([k, id]) => `  '${k}': '${esc(id)}',`);
writeFileSync(
  OUT,
  `/**
 * AUTO-GENERATED by scripts/build-scout-schedule.mjs — do not edit by hand.
 *
 * The frozen Scout daily schedule: dateKey -> secret footballer id. This file
 * is the single source of truth for the day's player, so every user on any
 * app version sees the same player. Rolling freeze: past days + the next two
 * weeks never change; days beyond that reshuffle when the daily pool changes
 * so new players enter the rotation quickly. Regenerated automatically by the
 * pre-commit hook (or manually via \`npm run scout:schedule\`).
 */

/** Fingerprint of the daily pool at generation time — guarded by schedule.test.ts. */
export const POOL_SIGNATURE = ${signature};

export const DAILY_SECRETS: Record<string, string> = {
${lines.join('\n')}
};
`,
);
console.log(
  `✓ ${schedule.size} days (${EPOCH_KEY} → ${horizonKey}) — kept ${kept}, added ${added}, ` +
    `reshuffled ${reshuffled}${replaced ? `, replaced ${replaced}` : ''}` +
    `${poolChanged ? ` (pool changed; frozen through ${freezeEndKey})` : ' (pool unchanged)'}`,
);
