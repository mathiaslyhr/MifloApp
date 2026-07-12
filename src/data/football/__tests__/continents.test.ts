/**
 * @format
 *
 * Guards the geography axis: EVERY nationality in the dataset must map to a
 * continent. An unmapped country would let a player who actually belongs to a
 * continent be picked as that continent's outlier — a silently wrong round.
 */
import {continentOf} from '../continents';
import {all} from '../repository';

describe('continent coverage', () => {
  it('maps every nationality that appears in footballers.ts', () => {
    const unmapped = new Set<string>();
    for (const f of all()) {
      for (const country of f.nationality) {
        if (!continentOf(country)) {
          unmapped.add(country);
        }
      }
    }
    expect([...unmapped].sort()).toEqual([]);
  });
});
