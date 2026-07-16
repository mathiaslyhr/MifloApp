import {FLAG_IMAGES} from '../../hattrick/assets/flags.generated';
import {fold} from '../../hattrick/playerSearch';
import {CITIES} from '../cities';
import {searchSuggestions} from '../suggestions';

describe('tenball decoy cities', () => {
  it('every city names a bundled flag country', () => {
    // The flag is the only art a place suggestion shows, and images never ship
    // OTA — an unbundled country would render flagless. Keep this green.
    const bad = CITIES.filter(c => !FLAG_IMAGES[c.country]).map(
      c => `${c.name} → ${c.country}`,
    );
    expect(bad).toEqual([]);
  });

  it('has no duplicate city names (folded)', () => {
    // dedupeByLabel keeps one entry per folded label, so a collision silently
    // drops a city (and its country) from the crowd.
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

  it('hides the CL-final answers in a much larger crowd', () => {
    // The whole point: the type-ahead must offer far more cities than the ten
    // answers so a player cannot pick them all blind. Typing a common prefix
    // now surfaces decoys alongside (or instead of) the answer.
    expect(CITIES.length).toBeGreaterThan(50);
    const forM = searchSuggestions('other', 'm', 5).map(e => e.label);
    // "Madrid"/"Munich"/"Milan"/"Moscow"/… — not just the answer city.
    expect(forM.length).toBe(5);
    expect(new Set(forM).size).toBe(5);
  });

  it('still surfaces an answer city with its stadium alias', () => {
    // Decoys merge under the answer's aliases via dedupeByLabel, so the list's
    // curated aliases keep matching.
    const forWembley = searchSuggestions('other', 'wembley', 5).map(e => e.label);
    expect(forWembley).toContain('London');
  });
});
