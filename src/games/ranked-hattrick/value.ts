/**
 * Ranked Value (€) — pure. The single competitive metric: a footballer-style
 * market value that rises on a win and falls on a loss (Clash-Royale trophies,
 * in euros). Opponent-weighted via ELO-style expected score over the value
 * itself; every result is shown in €. Mirrored by `rh_finish`/`rh_apply_loss`
 * in migration 0037 (the authority).
 */
import {VALUE_CAP, VALUE_FLOOR, VALUE_K, VALUE_SCALE} from './constants';

export type MatchResult = 'a' | 'b' | 'draw';

const clamp = (v: number) => Math.max(VALUE_FLOOR, Math.min(VALUE_CAP, v));

/** Probability A beats B, using their € values as the strength rating. */
export function expectedScore(valueA: number, valueB: number): number {
  return 1 / (1 + Math.pow(10, (valueB - valueA) / VALUE_SCALE));
}

/**
 * New values after a match. `delta` is A's € change; B mirrors it (before
 * clamping), so beating a higher-valued opponent pays more.
 */
export function applyValue(
  valueA: number,
  valueB: number,
  outcome: MatchResult,
): {a: number; b: number; delta: number} {
  const scoreA = outcome === 'a' ? 1 : outcome === 'draw' ? 0.5 : 0;
  const delta = Math.round(VALUE_K * (scoreA - expectedScore(valueA, valueB)));
  return {a: clamp(valueA + delta), b: clamp(valueB - delta), delta};
}

/** "€48M" / "€2.5M" (one decimal under €10M) / "€800k" (under €1M). */
export function formatValue(eur: number): string {
  const v = Math.max(0, Math.round(eur));
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    const shown = m >= 10 ? Math.round(m) : Math.round(m * 10) / 10;
    return `€${shown}M`;
  }
  return `€${Math.round(v / 1000)}k`;
}

/** A signed € change: "+€2.5M" / "−€1.2M" / "€0". */
export function formatDelta(eur: number): string {
  if (eur === 0) {
    return '€0';
  }
  const sign = eur > 0 ? '+' : '−';
  return `${sign}${formatValue(Math.abs(eur))}`;
}
