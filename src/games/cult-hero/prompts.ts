/**
 * Cult Hero prompt pool — auto-generated from the football dataset with a
 * quality gate, no hand-written questions. A prompt is one `Criterion` that at
 * least `MIN_ELIGIBLE` dataset players satisfy ("Name a player who has played
 * for Real Madrid"), so the pool grows on its own as the dataset grows.
 *
 * Prompts travel and persist as stable string keys (`club:real-madrid`,
 * `nat:Brazil`, `league:premier-league`, `honour:world-cup`): the wire format
 * in `game_state.promptKeys` AND the aggregation key of the global rarity
 * stats, so they must never change meaning. Each device localizes a key into
 * its own language via `promptText`.
 *
 * Candidates are recomputed on each call (no module-level cache) so an OTA
 * dataset hydrate is always respected.
 */
import type {TFunction} from 'i18next';
import {
  CLUBS,
  all,
  find,
  getClub,
  shuffle,
  type Criterion,
  type HonourType,
  type Rng,
} from '../../data/football';
import {countryName} from './countryNames';
import {MIN_ELIGIBLE} from './types';

export type PromptCandidate = {key: string; criterion: Criterion};

/** The five big leagues — the only ones dense enough to prompt on. */
const LEAGUE_LABELS: Record<string, string> = {
  'premier-league': 'Premier League',
  'la-liga': 'La Liga',
  'serie-a': 'Serie A',
  bundesliga: 'Bundesliga',
  'ligue-1': 'Ligue 1',
};

/**
 * Honours that make fun prompts. Deliberately short of the full HonourType
 * union: league-title/domestic-cup match half the dataset (boring), and the
 * quality gate filters out anything too thin anyway.
 */
const PROMPT_HONOURS: HonourType[] = [
  'champions-league',
  'europa-league',
  'world-cup',
  'european-championship',
  'copa-america',
  'ballon-dor',
  'golden-boot',
];

function passesGate(criterion: Criterion): boolean {
  return find([criterion]).length >= MIN_ELIGIBLE;
}

/** Every prompt the dataset currently supports, gate applied. */
export function promptCandidates(): PromptCandidate[] {
  const candidates: PromptCandidate[] = [];
  for (const club of CLUBS) {
    const criterion: Criterion = {kind: 'club', clubId: club.id};
    if (passesGate(criterion)) {
      candidates.push({key: `club:${club.id}`, criterion});
    }
  }
  const countries = new Set(all().flatMap(f => f.nationality));
  for (const country of [...countries].sort()) {
    const criterion: Criterion = {kind: 'nationality', country};
    if (passesGate(criterion)) {
      candidates.push({key: `nat:${country}`, criterion});
    }
  }
  for (const league of Object.keys(LEAGUE_LABELS)) {
    const criterion: Criterion = {kind: 'league', league};
    if (passesGate(criterion)) {
      candidates.push({key: `league:${league}`, criterion});
    }
  }
  for (const honour of PROMPT_HONOURS) {
    const criterion: Criterion = {kind: 'honour', honour};
    if (passesGate(criterion)) {
      candidates.push({key: `honour:${honour}`, criterion});
    }
  }
  return candidates;
}

/**
 * A key back into its criterion — used by the host to build the eligible sets
 * and by every device to render the prompt. Null for anything malformed, so a
 * stale or foreign key degrades to a skipped prompt instead of a crash.
 */
export function parsePromptKey(key: string): Criterion | null {
  const colon = key.indexOf(':');
  if (colon <= 0 || colon === key.length - 1) {
    return null;
  }
  const kind = key.slice(0, colon);
  const value = key.slice(colon + 1);
  switch (kind) {
    case 'club':
      return getClub(value) ? {kind: 'club', clubId: value} : null;
    case 'nat':
      return {kind: 'nationality', country: value};
    case 'league':
      return value in LEAGUE_LABELS ? {kind: 'league', league: value} : null;
    case 'honour':
      return PROMPT_HONOURS.includes(value as HonourType)
        ? {kind: 'honour', honour: value as HonourType}
        : null;
    default:
      return null;
  }
}

/** At most this many prompts of one kind per game, for variety. */
const MAX_PER_KIND = 2;

const kindOf = (key: string) => key.slice(0, key.indexOf(':'));

/**
 * Deal `rounds` distinct prompt keys: shuffled, preferring ones not in `used`
 * (the session's chronological history, oldest first), never more than
 * MAX_PER_KIND of the same kind.
 */
export function buildPromptKeys(
  rounds: number,
  rng: Rng = Math.random,
  used: string[] = [],
): string[] {
  const pool = promptCandidates().map(c => c.key);
  const fresh = shuffle(pool.filter(k => !used.includes(k)), rng);
  // Refill from the history oldest-first, so repeats come back last-heard-last.
  const refill = used.filter(k => pool.includes(k));
  const picked: string[] = [];
  const perKind: Record<string, number> = {};
  for (const key of [...fresh, ...refill]) {
    if (picked.length >= rounds) {
      break;
    }
    const kind = kindOf(key);
    if (picked.includes(key) || (perKind[kind] ?? 0) >= MAX_PER_KIND) {
      continue;
    }
    picked.push(key);
    perKind[kind] = (perKind[kind] ?? 0) + 1;
  }
  return shuffle(picked, rng);
}

/** A prompt key rendered in the device's language. */
export function promptText(key: string, t: TFunction, language: string): string {
  const criterion = parsePromptKey(key);
  if (!criterion) {
    return '';
  }
  switch (criterion.kind) {
    case 'club':
      return t('cultHero.prompt.club', {
        club: getClub(criterion.clubId)?.name ?? criterion.clubId,
      });
    case 'nationality':
      return t('cultHero.prompt.nat', {
        country: countryName(criterion.country, language),
      });
    case 'league':
      return t('cultHero.prompt.league', {
        league: LEAGUE_LABELS[criterion.league] ?? criterion.league,
      });
    case 'honour':
      return t(`cultHero.prompt.honour.${criterion.honour}`);
    default:
      return '';
  }
}

// ── Online session memory ────────────────────────────────────────────────────
// Only the host device deals prompts (start + Play again), so an in-memory
// history keyed by roomId is enough to stop repeats across games of a party.
// It lives for the app run; a force-quit forgets it, which at worst repeats
// sooner than ideal. Mirrors red-card/questions.ts.

const sessionUsed = new Map<string, string[]>();

function remember(used: string[], picked: string[]): string[] {
  return [...used.filter(k => !picked.includes(k)), ...picked];
}

/** Fold already-dealt keys (e.g. the current game) into a party's history. */
export function notePrompts(sessionKey: string, keys: string[]): void {
  sessionUsed.set(sessionKey, remember(sessionUsed.get(sessionKey) ?? [], keys));
}

/** Deal a game's prompts for a party and record them in its history. */
export function takeSessionPrompts(
  sessionKey: string,
  rounds: number,
  rng: Rng = Math.random,
): string[] {
  const used = sessionUsed.get(sessionKey) ?? [];
  const keys = buildPromptKeys(rounds, rng, used);
  sessionUsed.set(sessionKey, remember(used, keys));
  return keys;
}
