import {gapToTop} from '../board';

describe('the gap to the last visible place', () => {
  it('is the € still needed to get there', () => {
    expect(gapToTop(8_200_000, 19_000_000)).toBe(10_800_000);
  });

  it('is null once you are already level', () => {
    // Reachable: you can rank 11th on a value tie that updated_at broke, so
    // "€0 to reach the top 10" is a line that must never render.
    expect(gapToTop(19_000_000, 19_000_000)).toBeNull();
  });

  it('is null when you are already above it', () => {
    expect(gapToTop(24_000_000, 19_000_000)).toBeNull();
  });
});
