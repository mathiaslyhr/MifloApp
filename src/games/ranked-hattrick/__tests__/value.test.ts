import {applyValue, expectedScore, formatDelta, formatValue} from '../value';
import {VALUE_CAP, VALUE_FLOOR, VALUE_K} from '../constants';

describe('expectedScore', () => {
  it('is 0.5 for equal values and symmetric', () => {
    expect(expectedScore(20_000_000, 20_000_000)).toBeCloseTo(0.5, 6);
    expect(
      expectedScore(50_000_000, 10_000_000) + expectedScore(10_000_000, 50_000_000),
    ).toBeCloseTo(1, 6);
  });
});

describe('applyValue', () => {
  it('an even win gains ~K/2 and is mirrored', () => {
    const {a, b, delta} = applyValue(20_000_000, 20_000_000, 'a');
    expect(delta).toBe(Math.round(VALUE_K * 0.5));
    expect(a).toBe(20_000_000 + delta);
    expect(b).toBe(20_000_000 - delta);
  });

  it('beating a higher-valued opponent pays more than beating a lower one', () => {
    const upset = applyValue(10_000_000, 80_000_000, 'a').delta;
    const expected = applyValue(80_000_000, 10_000_000, 'a').delta;
    expect(upset).toBeGreaterThan(expected);
  });

  it('a draw between equals barely moves', () => {
    expect(applyValue(20_000_000, 20_000_000, 'draw').delta).toBe(0);
  });

  it('clamps at the floor and the cap', () => {
    expect(applyValue(VALUE_FLOOR, 250_000_000, 'b').a).toBe(VALUE_FLOOR);
    expect(applyValue(VALUE_CAP, 1_000_000, 'a').a).toBe(VALUE_CAP);
  });
});

describe('formatting', () => {
  it('formats values by magnitude', () => {
    expect(formatValue(48_000_000)).toBe('€48M');
    expect(formatValue(2_500_000)).toBe('€2.5M');
    expect(formatValue(800_000)).toBe('€800k');
  });

  it('signs deltas', () => {
    expect(formatDelta(2_500_000)).toBe('+€2.5M');
    expect(formatDelta(-1_200_000)).toBe('−€1.2M');
    expect(formatDelta(0)).toBe('€0');
  });
});
