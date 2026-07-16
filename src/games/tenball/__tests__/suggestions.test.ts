import {searchSuggestions} from '../suggestions';

describe('tenball `other` suggestions (cities)', () => {
  it('hides the CL-final answers in a much larger crowd', () => {
    // The shared cities dataset is unioned into the `other` pool so the ten
    // answers are no longer the only suggestions — a player cannot pick them
    // all blind. A common prefix now returns a full page of distinct cities.
    const forM = searchSuggestions('other', 'm', 5).map(e => e.label);
    expect(forM.length).toBe(5);
    expect(new Set(forM).size).toBe(5);
  });

  it('still surfaces an answer city via its curated stadium alias', () => {
    // dedupeByLabel merges the list answer's aliases under the decoy entry, so
    // the list's curated aliases keep matching.
    const forWembley = searchSuggestions('other', 'wembley', 5).map(e => e.label);
    expect(forWembley).toContain('London');
  });
});
