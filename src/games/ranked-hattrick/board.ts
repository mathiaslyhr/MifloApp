/**
 * The ranked leaderboard's arithmetic — pure.
 *
 * (This once also held barFraction(), for a per-row bar showing each player's €
 * as a share of the leader's. The bar was built, looked at, and cut: see the
 * note in screens/ranked/RankedBoardRow. If it ever comes back, it comes back
 * with a test.)
 */

/**
 * The € still needed to reach the last visible place, or null when there's no
 * gap to show. Null covers both "already there or above" and a tie on value
 * that rank broke by updated_at — "€0 to reach the top 10" is nonsense to read.
 */
export function gapToTop(myValue: number, lastValue: number): number | null {
  const gap = lastValue - myValue;
  return gap > 0 ? gap : null;
}
