import {TIERS, tierFor} from '../tiers';
import {VALUE_CAP, VALUE_FLOOR, VALUE_START} from '../constants';

describe('the tier ladder', () => {
  it('is ascending, and starts at the value floor', () => {
    expect(TIERS[0].min).toBe(VALUE_FLOOR);
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].min).toBeGreaterThan(TIERS[i - 1].min);
    }
  });

  it('starts a new player on a rung with room above and below', () => {
    const {tier, next} = tierFor(VALUE_START); // €10M
    expect(tier.key).toBe('squad');
    expect(next?.key).toBe('firstTeam');
  });

  it('a rung starts the moment its min is reached', () => {
    expect(tierFor(14_999_999).tier.key).toBe('squad');
    expect(tierFor(15_000_000).tier.key).toBe('firstTeam');
    expect(tierFor(15_000_000).progress).toBe(0);
  });

  it('progress runs 0 → 1 across the rung', () => {
    // firstTeam spans €15M → €40M; €27.5M is halfway.
    expect(tierFor(27_500_000).progress).toBeCloseTo(0.5, 5);
    expect(tierFor(39_999_999).progress).toBeGreaterThan(0.99);
  });

  it('the top rung has no next and measures toward the cap', () => {
    const top = tierFor(200_000_000);
    expect(top.tier.key).toBe('worldClass');
    expect(top.next).toBeNull();
    expect(top.progress).toBeCloseTo(0.5, 5); // €150M → €250M
    expect(tierFor(VALUE_CAP).progress).toBe(1);
  });

  it('clamps outside the floor and the cap', () => {
    expect(tierFor(0).tier.key).toBe('prospect');
    expect(tierFor(0).progress).toBe(0);
    expect(tierFor(VALUE_CAP + 50_000_000).progress).toBe(1);
  });
});
