/**
 * Name matching + autocomplete for Missing XI. A guess is accepted if its
 * normalized form equals the hidden player's name, its surname, or any alias —
 * so accents, casing, and surname-only answers all work ("ozil" → "Mesut Özil",
 * "iniesta" → "Andrés Iniesta").
 *
 * The autocomplete pool is the union of every footballer in the fact layer and
 * every name/alias across the famous lineups, so suggestions cover historical
 * players who predate footballers.ts.
 */
import {all, derivedFromData, FAMOUS_LINEUPS, type LineupPlayer} from '../../data/football';

/** Lowercase, strip diacritics + punctuation, collapse whitespace. */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation/apostrophes → space
    .replace(/\s+/g, ' ')
    .trim();
}

/** Last whitespace-separated token of a name, e.g. "Mesut Özil" → "özil". */
function surname(name: string): string {
  const parts = normalize(name).split(' ');
  return parts[parts.length - 1] ?? '';
}

/** Every normalized form that should count as naming this player. */
export function acceptedForms(player: LineupPlayer): Set<string> {
  const forms = new Set<string>();
  forms.add(normalize(player.name));
  const sur = surname(player.name);
  if (sur) {
    forms.add(sur);
  }
  for (const alias of player.aliases ?? []) {
    forms.add(normalize(alias));
  }
  return forms;
}

/** Whether a typed guess names the hidden player. */
export function isCorrectGuess(guess: string, player: LineupPlayer): boolean {
  const g = normalize(guess);
  return g.length > 0 && acceptedForms(player).has(g);
}

/** Sorted, de-duped autocomplete pool of display names across all sources. */
function buildNamePool(): string[] {
  const names = new Set<string>();
  for (const f of all()) {
    names.add(f.name);
  }
  for (const lineup of FAMOUS_LINEUPS) {
    for (const p of lineup.players) {
      names.add(p.name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Pre-normalized pool so suggestions don't re-normalize on every keystroke. */
const normalizedPool = derivedFromData((): {name: string; norm: string}[] =>
  buildNamePool().map(name => ({name, norm: normalize(name)})),
);

/**
 * Autocomplete suggestions for the current input: names whose normalized form
 * contains the query, prefix matches first. Empty query → no suggestions.
 */
export function suggestNames(query: string, limit = 6): string[] {
  const q = normalize(query);
  if (q.length === 0) {
    return [];
  }
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const {name, norm} of normalizedPool()) {
    if (norm.startsWith(q)) {
      prefix.push(name);
    } else if (norm.includes(q)) {
      contains.push(name);
    }
    if (prefix.length >= limit) {
      break;
    }
  }
  return [...prefix, ...contains].slice(0, limit);
}
