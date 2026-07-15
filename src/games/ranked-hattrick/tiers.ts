/**
 * Ranked tiers — pure. The € value is one long number (€1M → €250M); these are
 * the rungs that turn it into an identity ("Squad player", "World class"), and
 * the progress toward the next one. Display names live in i18n under
 * `play.tiers.*`; only the keys are stable here.
 */
import {VALUE_CAP, VALUE_FLOOR} from './constants';

export type Tier = {key: string; min: number};

/** Ascending by `min`. The first rung starts at the value floor. */
export const TIERS: Tier[] = [
  {key: 'prospect', min: VALUE_FLOOR}, // €1M
  {key: 'squad', min: 5_000_000},
  {key: 'firstTeam', min: 15_000_000},
  {key: 'keyPlayer', min: 40_000_000},
  {key: 'star', min: 80_000_000},
  {key: 'worldClass', min: 150_000_000},
];

export type TierStanding = {
  tier: Tier;
  /** The rung above, or null on the top rung. */
  next: Tier | null;
  /** 0..1 through the current rung. The top rung measures toward VALUE_CAP. */
  progress: number;
};

export function tierFor(value: number): TierStanding {
  const v = Math.max(VALUE_FLOOR, Math.min(VALUE_CAP, value));
  let i = 0;
  for (let n = 0; n < TIERS.length; n++) {
    if (v >= TIERS[n].min) {
      i = n;
    }
  }
  const tier = TIERS[i];
  const next = i < TIERS.length - 1 ? TIERS[i + 1] : null;
  const ceiling = next ? next.min : VALUE_CAP;
  const span = ceiling - tier.min;
  const progress = span <= 0 ? 1 : Math.max(0, Math.min(1, (v - tier.min) / span));
  return {tier, next, progress};
}
