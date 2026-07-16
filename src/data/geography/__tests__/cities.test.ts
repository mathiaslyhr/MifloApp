import {FLAG_IMAGES} from '../../../games/hattrick/assets/flags.generated';
import {fold} from '../../../games/hattrick/playerSearch';
import {CITIES} from '../cities';

describe('cities dataset', () => {
  it('every city names a bundled flag country', () => {
    // Keeps the dataset flag-renderable for any consumer: the flag is the only
    // art a place shows, and images never ship OTA, so an unbundled country
    // would render nothing.
    const bad = CITIES.filter(c => !FLAG_IMAGES[c.country]).map(
      c => `${c.name} → ${c.country}`,
    );
    expect(bad).toEqual([]);
  });

  it('has no duplicate city names (folded)', () => {
    // Consumers dedupe by folded label, so a collision silently drops a city
    // (and its country) from the pool.
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const c of CITIES) {
      const key = fold(c.name);
      if (seen.has(key)) {
        dupes.push(c.name);
      }
      seen.add(key);
    }
    expect(dupes).toEqual([]);
  });

  it('is a broad crowd, not a handful', () => {
    expect(CITIES.length).toBeGreaterThan(50);
  });
});
