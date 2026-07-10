// Generate/extend the frozen Team sheet daily schedule (schedule.generated.ts).
//
// Same model as build-tenball-schedule.mjs, over the Team sheet eligible
// lineup pool: an explicit dateKey -> lineup id map committed to the repo
// (and shipped in the OTA pack), so every device agrees on the day's XI even
// while packs with new lineups roll out. Rolling freeze: every date up to
// today+FREEZE_DAYS is permanent; beyond that, dates reshuffle whenever the
// pool changes so new lineups enter the rotation quickly. Manual run:
//
//   npm run teamsheet:schedule
//
// Assignment: seeded Fisher–Yates permutations of the pool, walked one lineup
// per day, skipping anything scheduled in the previous RECENT_WINDOW days —
// and never putting the same team (or the other bench of the same match, e.g.
// Croatia 2018 right after France 2018) on consecutive days.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root} from './_load-football.mjs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {hashDateKey, seededRng} = require(resolve(root, 'src/games/scout/dailySeed.ts'));
const {shuffle} = require(resolve(root, 'src/data/football/repository.ts'));
const {FAMOUS_LINEUPS, isTeamsheetLineup} = require(
  resolve(root, 'src/data/football/famousLineups.ts'),
);

const OUT = resolve(root, 'src/games/teamsheet/schedule.generated.ts');
const EPOCH_KEY = '2026-07-01';
/** How far past today the schedule must reach (days). */
const HORIZON_DAYS = 180;
/** Days ahead of today that stay frozen even when the pool changes. */
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
const pool = FAMOUS_LINEUPS.filter(isTeamsheetLineup);
const poolIds = pool.map(l => l.id).sort();
if (poolIds.length < 4) {
  throw new Error('teamsheet schedule needs at least 4 eligible lineups');
}
const byId = new Map(pool.map(l => [l.id, l]));
/** A lineup cannot reappear within this many days. Derived so it keeps up as
 * the pool grows: ~12 at 20 lineups, ~60 at 100. */
const RECENT_WINDOW = Math.min(poolIds.length - 1, Math.floor(poolIds.length * 0.6));

/** Same team two days running, or the other bench of the same match. */
const clashesWithPrevious = (id, prevId) => {
  const lineup = byId.get(id);
  const prev = prevId ? byId.get(prevId) : undefined;
  if (!lineup || !prev) {
    return false;
  }
  return (
    lineup.team === prev.team ||
    (lineup.year === prev.year && lineup.team === prev.match?.opponent)
  );
};

const validIds = new Set(poolIds);
const existing = new Map();
let previousSignature;
if (existsSync(OUT)) {
  const source = readFileSync(OUT, 'utf8');
  previousSignature = Number(source.match(/POOL_SIGNATURE = (\d+)/)?.[1]);
  for (const line of source.split('\n')) {
    const m = line.match(/^  '(\d{4}-\d{2}-\d{2})': '([^']*)',$/);
    if (m) {
      existing.set(m[1], m[2]);
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
const signature = hashDateKey(poolIds.join('|'));
const poolChanged = previousSignature !== signature;
const freezeEnd = new Date();
freezeEnd.setDate(freezeEnd.getDate() + FREEZE_DAYS);
const freezeEndKey = dateKeyFor(freezeEnd);
const anchor = poolChanged
  ? nextDateKey(freezeEndKey)
  : allDates.find(k => !validIds.has(existing.get(k) ?? '')) ?? horizonKey;
let cycle = 0;
let perm = [];
let permIdx = 0;
function nextFreshId(recentSet, prevId) {
  for (;;) {
    while (permIdx < perm.length) {
      const id = perm[permIdx++];
      if (!recentSet.has(id) && !clashesWithPrevious(id, prevId)) {
        return id;
      }
    }
    perm = shuffle(poolIds, seededRng(hashDateKey(`teamsheet#${anchor}#${cycle++}`)));
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
let prevId;
for (const key of allDates) {
  const current = existing.get(key);
  const frozen = key <= freezeEndKey || !poolChanged;
  if (current !== undefined && validIds.has(current) && frozen) {
    schedule.set(key, current);
    remember(current);
    prevId = current;
    kept++;
    continue;
  }
  if (current === undefined) {
    added++;
  } else if (!validIds.has(current)) {
    console.warn(`⚠ ${key}: '${current}' is no longer an eligible lineup — reassigning`);
    replaced++;
  } else {
    reshuffled++;
  }
  const id = nextFreshId(recentSet, prevId);
  schedule.set(key, id);
  remember(id);
  prevId = id;
}

// ---- Write ------------------------------------------------------------------
const lines = [...schedule.entries()].map(([k, id]) => `  '${k}': '${id}',`);
writeFileSync(
  OUT,
  `/**
 * AUTO-GENERATED by scripts/build-teamsheet-schedule.mjs — do not edit by hand.
 *
 * The frozen Team sheet daily schedule: dateKey -> famous lineup id. This
 * file (and the OTA pack copy of it) is the source of truth for the day's XI,
 * so every user on any app version sees the same team sheet. Rolling freeze:
 * past days and the near future never change; days beyond the freeze
 * reshuffle when the lineup pool changes so new XIs enter the rotation
 * quickly. Regenerated via \`npm run teamsheet:schedule\`.
 */

/** Fingerprint of the eligible lineup pool at generation time. */
export const POOL_SIGNATURE = ${signature};

export const TEAMSHEET_SCHEDULE: Record<string, string> = {
${lines.join('\n')}
};
`,
);
console.log(
  `✓ ${schedule.size} days (${EPOCH_KEY} → ${horizonKey}) — kept ${kept}, added ${added}, ` +
    `reshuffled ${reshuffled}${replaced ? `, replaced ${replaced}` : ''}` +
    `${poolChanged ? ` (pool changed; frozen through ${freezeEndKey})` : ' (pool unchanged)'}`,
);
