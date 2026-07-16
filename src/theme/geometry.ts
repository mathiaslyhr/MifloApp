/**
 * Geometry helpers for pinning a small round thing to a big round thing.
 *
 * Used by every presence dot (avatar corner) and the Team sheet clue badges.
 * Both had been eyeballed — 0, −1, 2, all slightly wrong — which is what this
 * exists to stop.
 */

/**
 * Absolute offset that puts a badge's centre exactly ON a circle's outline at
 * the 45° point, for the corner it's pinned to.
 *
 * Feed it to whichever pair of edges the badge uses (`top`/`left`,
 * `right`/`bottom`, …) — the value is the same for all four by symmetry.
 *
 *   r − r/√2 − badge/2 − border
 *
 * `border` is the easy one to miss: an absolutely positioned child is laid out
 * against its parent's PADDING box, which starts inside the parent's border.
 * Pass the parent's `borderWidth` when it has one (the Team sheet circle), and
 * leave it 0 when it doesn't (a plain View wrapping an Avatar).
 */
export function onRim(diameter: number, badge: number, border = 0): number {
  return diameter / 2 - diameter / (2 * Math.SQRT2) - badge / 2 - border;
}
