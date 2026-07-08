import {FOOTBALLERS, getById, matches, TREBLE_SQUADS} from '../index';

describe('treble + ballon dor matching', () => {
  it('every curated treble squad member exists in the dataset', () => {
    const missing = TREBLE_SQUADS.flatMap(s =>
      s.playerIds.filter(id => getById(id) == null).map(id => `${s.clubId} ${s.season}: ${id}`),
    );
    expect(missing).toEqual([]);
  });

  it('Messi matches ballon-dor and treble criteria', () => {
    const messi = getById('Messi, Lionel')!;
    expect(messi).toBeDefined();
    expect(matches(messi, {kind: 'honour', honour: 'ballon-dor'})).toBe(true);
    expect(matches(messi, {kind: 'treble'})).toBe(true);
  });

  it('treble axis has enough players to be usable', () => {
    const n = FOOTBALLERS.filter(f => matches(f, {kind: 'treble'})).length;
    expect(n).toBeGreaterThanOrEqual(4);
  });
});
