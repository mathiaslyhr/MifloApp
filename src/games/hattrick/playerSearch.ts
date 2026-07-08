/**
 * Player-picker search. Diacritic-insensitive, prefix-first ranking so typing
 * "g" surfaces Gavi/Griezmann (not "Adingra"), "o" matches "ó" (João Félix),
 * and known nicknames ("r9" → Ronaldo Nazário) are searchable.
 */
import type {Footballer} from '../../data/football';

/** Strip accents and lowercase, so "João"/"Müller" match plain ASCII input. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Relevance of a footballer to a folded query, higher = better. 0 = no match.
 *  5 exact name / nickname · 4 full-name prefix · 3 name-token or nickname prefix
 *  2 full-name-token prefix · 1 substring anywhere.
 */
export function scoreFootballer(f: Footballer, q: string): number {
  if (!q) {
    return 0;
  }
  const name = fold(f.name);
  const nameTokens = name.split(/\s+/);
  const full = f.fullName ? fold(f.fullName) : '';
  const fullTokens = full ? full.split(/\s+/) : [];
  const nicks = (f.nicknames ?? []).map(fold);

  if (name === q || nicks.includes(q)) {
    return 5;
  }
  if (name.startsWith(q)) {
    return 4;
  }
  if (nameTokens.some(t => t.startsWith(q)) || nicks.some(n => n.startsWith(q))) {
    return 3;
  }
  if (full.startsWith(q) || fullTokens.some(t => t.startsWith(q))) {
    return 2;
  }
  if (name.includes(q) || full.includes(q) || nicks.some(n => n.includes(q))) {
    return 1;
  }
  return 0;
}

/**
 * Ranked, deduped search over `pool`, excluding `usedIds`. Ties broken
 * alphabetically by display name. Returns at most `limit` entries.
 */
export function searchPlayers(
  pool: readonly Footballer[],
  rawQuery: string,
  usedIds: readonly string[] = [],
  limit = 40,
): Footballer[] {
  const q = fold(rawQuery);
  if (!q) {
    return [];
  }
  const used = new Set(usedIds);
  const scored: {f: Footballer; score: number}[] = [];
  for (const f of pool) {
    if (used.has(f.id)) {
      continue;
    }
    const score = scoreFootballer(f, q);
    if (score > 0) {
      scored.push({f, score});
    }
  }
  scored.sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name));
  return scored.slice(0, limit).map(s => s.f);
}
