/**
 * Generic name search for non-footballer answer pools (clubs, nations,
 * managers, …). Same diacritic-insensitive, prefix-first ranking as
 * playerSearch, generalized over arbitrary labelled entries.
 */
import {fold} from '../hattrick/playerSearch';

export type NameEntry = {
  /** What the suggestion row shows. */
  label: string;
  /** What tapping the row submits (usually the label). */
  submitText: string;
  /** Folded strings the query is matched against (label + aliases). */
  searchTexts: string[];
  /** Nationality string for `flagImage()` when the entry has one. */
  flagCountry?: string;
  /**
   * Club id for `logoImage()`. A club answer should wear its own crest, not
   * the flag of the country it plays in — but only dataset-backed clubs have
   * an id, so `flagCountry` stays the fallback for list-sourced historic names
   * (Pro Vercelli and friends) and for any club whose art we cannot resolve.
   */
  clubId?: string;
};

/** Build a NameEntry, folding label + aliases into searchTexts. */
export function nameEntry(
  label: string,
  aliases: readonly string[] = [],
  flagCountry?: string,
  clubId?: string,
): NameEntry {
  const searchTexts = [...new Set([fold(label), ...aliases.map(fold)])];
  return {label, submitText: label, searchTexts, flagCountry, clubId};
}

/** 5 exact · 3 text-prefix · 2 token-prefix · 1 substring (playerSearch ladder). */
function scoreEntry(entry: NameEntry, q: string): number {
  let best = 0;
  for (const text of entry.searchTexts) {
    if (text === q) {
      return 5;
    }
    if (text.startsWith(q)) {
      best = Math.max(best, 3);
    } else if (text.split(/\s+/).some(t => t.startsWith(q))) {
      best = Math.max(best, 2);
    } else if (text.includes(q)) {
      best = Math.max(best, 1);
    }
  }
  return best;
}

/**
 * Ranked search over `pool`; ties break alphabetically by label. Callers pass
 * pools deduped by folded label (see `dedupeByLabel`).
 */
export function searchNames(
  pool: readonly NameEntry[],
  rawQuery: string,
  limit = 5,
): NameEntry[] {
  const q = fold(rawQuery);
  if (!q) {
    return [];
  }
  const scored: {entry: NameEntry; score: number}[] = [];
  for (const entry of pool) {
    const score = scoreEntry(entry, q);
    if (score > 0) {
      scored.push({entry, score});
    }
  }
  scored.sort(
    (a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label),
  );
  return scored.slice(0, limit).map(s => s.entry);
}

/**
 * One entry per folded label, keeping the first (canonical) entry's label and
 * flag but merging every duplicate's searchTexts — a club list's aliases
 * ("inter milan") must keep matching after the CLUBS-sourced entry wins.
 */
export function dedupeByLabel(entries: readonly NameEntry[]): NameEntry[] {
  const byLabel = new Map<string, NameEntry>();
  for (const entry of entries) {
    const key = fold(entry.label);
    const kept = byLabel.get(key);
    if (!kept) {
      byLabel.set(key, {...entry, searchTexts: [...entry.searchTexts]});
    } else {
      for (const text of entry.searchTexts) {
        if (!kept.searchTexts.includes(text)) {
          kept.searchTexts.push(text);
        }
      }
    }
  }
  return [...byLabel.values()];
}
