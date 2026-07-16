/**
 * @format
 */
import {onRim} from '../geometry';

/**
 * Where the badge's centre actually lands, given the offset `onRim` returns.
 *
 * Mirrors what the renderer does: the badge is absolutely positioned inside the
 * parent's PADDING box (which starts `border` in from the parent's edge), so a
 * `top`/`left` of `o` puts the badge's centre at `border + o + badge/2` in the
 * parent's border-box coordinates. Returns its distance from the parent's
 * centre — which must equal the parent's radius for the badge to sit ON the
 * outline.
 */
function centreDistance(diameter: number, badge: number, border = 0): number {
  const o = onRim(diameter, badge, border);
  const centre = border + o + badge / 2;
  const delta = diameter / 2 - centre; // per axis, toward the parent's centre
  return Math.hypot(delta, delta);
}

describe('onRim', () => {
  // Every real caller. If one of these drifts, a badge has left the outline.
  const cases: [string, number, number, number][] = [
    ['Team sheet clue badge', 50, 16, 2],
    ['ProfileHeader presence dot', 72, 14, 0],
    ['PersonCard / FriendsList dot', 44, 12, 0],
    ['FriendTodayCard dot', 40, 12, 0],
    ['InviteFriendsSheet dot', 28, 10, 0],
  ];

  it.each(cases)(
    '%s centre lands exactly on the outline',
    (_label, diameter, badge, border) => {
      expect(centreDistance(diameter, badge, border)).toBeCloseTo(
        diameter / 2,
        6,
      );
    },
  );

  it('subtracts the parent border — the bug that put every badge inside the rim', () => {
    // A 2pt border pulls the badge 2pt inward on BOTH axes: 2√2 ≈ 2.83pt
    // diagonally, which is what a screenshot measured (22.16pt from centre when
    // the rim sat at 25pt).
    const withBorder = onRim(50, 16, 2);
    const without = onRim(50, 16, 0);
    expect(without - withBorder).toBe(2);
    expect(centreDistance(50, 16, 2)).toBeCloseTo(25, 6);
    // Ignoring the border is exactly the 2.83pt error that was shipped.
    const naive = 2 + without + 16 / 2;
    const naiveDelta = 50 / 2 - naive;
    expect(25 - Math.hypot(naiveDelta, naiveDelta)).toBeCloseTo(2 * Math.SQRT2, 6);
  });

  it('is symmetric, so one value serves all four corners', () => {
    // The offset is measured from whichever edges the badge pins to, and the
    // padding box is symmetric — so top/left and right/bottom take the same
    // number. Guards against a "fix" that special-cases one corner.
    expect(onRim(72, 14)).toBeCloseTo(72 / 2 - 72 / (2 * Math.SQRT2) - 7, 6);
  });
});
