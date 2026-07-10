/**
 * The fame prior — Cult Hero's cold-start answer to "who counts as obscure?".
 *
 * Rarity is ultimately judged by real pick counts aggregated across all games
 * (see the 0018 migration), but a brand-new prompt has no history. So the host
 * ships, per prompt, its eligible players with pseudo-counts derived from this
 * editorial heuristic: honours, career volume, big-league exposure and the
 * curated tags. Normalized so the average player carries PSEUDO_PER_PLAYER
 * pseudo-picks — heavy enough for sensible day-one scores, light enough that
 * a few dozen real games overtake it.
 *
 * Everything recomputes from the live dataset on each call (no module cache),
 * so an OTA hydrate is always respected.
 */
import {find, leaguesOf, type Footballer, type HonourType} from '../../data/football';
import {parsePromptKey} from './prompts';
import {PSEUDO_PER_PLAYER} from './types';

/** How loudly each honour type signals fame. */
const HONOUR_WEIGHT: Record<HonourType, number> = {
  'ballon-dor': 6,
  'world-cup': 5,
  'champions-league': 4,
  'european-championship': 3,
  'copa-america': 3,
  'league-title': 2,
  'europa-league': 2,
  'golden-boot': 2,
  'player-of-the-season': 1,
  'domestic-cup': 1,
};

const HONOUR_CAP = 24;
const APPS_CAP = 6;
const TOP5_LEAGUES = new Set([
  'premier-league',
  'la-liga',
  'serie-a',
  'bundesliga',
  'ligue-1',
]);

/** A player's editorial fame score, 1 (unknown) to ~43 (all-time great). */
export function famePrior(f: Footballer): number {
  let honourPoints = 0;
  for (const h of f.honours) {
    const times = Math.max(1, h.count ?? h.years?.length ?? 1);
    honourPoints += HONOUR_WEIGHT[h.type] * times;
  }
  honourPoints = Math.min(HONOUR_CAP, honourPoints);

  const apps = f.clubs.reduce((sum, spell) => sum + (spell.appearances ?? 0), 0);
  const appsPoints = Math.min(APPS_CAP, Math.floor(apps / 100));

  const top5 = leaguesOf(f).filter(l => TOP5_LEAGUES.has(l)).length;
  const leaguePoints = 2 * Math.min(3, top5);

  const tags = f.tags ?? [];
  const tagPoints =
    (tags.includes('legends') ? 8 : 0) + (tags.includes('current-stars') ? 4 : 0);

  return 1 + honourPoints + appsPoints + leaguePoints + tagPoints;
}

/** One eligible player with their pseudo-count, as shipped to the server. */
export type EligibleEntry = {id: string; w: number};

/**
 * Fame priors normalized into pseudo-counts summing to PSEUDO_PER_PLAYER per
 * player, rounded to 2 decimals (jsonb-friendly, still strictly positive).
 */
export function normalizePriors(players: readonly Footballer[]): EligibleEntry[] {
  const priors = players.map(famePrior);
  const sum = priors.reduce((s, p) => s + p, 0);
  const total = PSEUDO_PER_PLAYER * players.length;
  return players.map((f, i) => ({
    id: f.id,
    w: Math.round((total * priors[i] * 100) / sum) / 100,
  }));
}

/** The host's start payload: each prompt's eligible set with its priors. */
export type PromptPayload = {key: string; eligible: EligibleEntry[]};

export function buildPromptPayloads(keys: string[]): PromptPayload[] {
  return keys.map(key => {
    const criterion = parsePromptKey(key);
    return {key, eligible: normalizePriors(criterion ? find([criterion]) : [])};
  });
}
