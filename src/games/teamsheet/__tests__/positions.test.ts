import {FAMOUS_LINEUPS, isTeamsheetLineup} from '../../../data/football';
import {positionLabels} from '../positions';

const ALLOWED = new Set([
  'GK', 'RB', 'LB', 'RWB', 'LWB', 'CB', 'DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST',
]);

describe('positionLabels', () => {
  it('labels the classic shapes sensibly', () => {
    expect(positionLabels('4-3-3')).toEqual([
      'GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CM', 'CM', 'RW', 'ST', 'LW',
    ]);
    // Flat midfield four: wide men are RM/LM, not wingers.
    expect(positionLabels('4-4-2')).toEqual([
      'GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'ST', 'ST',
    ]);
    expect(positionLabels('4-2-3-1')).toEqual([
      'GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'DM', 'RW', 'AM', 'LW', 'ST',
    ]);
    // Back three: the wide men of the five-band are wing-backs.
    expect(positionLabels('3-5-2')).toEqual([
      'GK', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CM', 'CM', 'LWB', 'ST', 'ST',
    ]);
    // Back five: wing-backs on the outside of the defensive line.
    expect(positionLabels('5-3-2')).toEqual([
      'GK', 'RWB', 'CB', 'CB', 'CB', 'LWB', 'CM', 'CM', 'CM', 'ST', 'ST',
    ]);
    expect(positionLabels('3-2-4-1')).toEqual([
      'GK', 'CB', 'CB', 'CB', 'DM', 'DM', 'RW', 'AM', 'AM', 'LW', 'ST',
    ]);
    expect(positionLabels('3-4-2-1')).toEqual([
      'GK', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CM', 'LWB', 'AM', 'AM', 'ST',
    ]);
    expect(positionLabels('4-3-1-2')).toEqual([
      'GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CM', 'CM', 'AM', 'ST', 'ST',
    ]);
    expect(positionLabels('4-4-1-1')).toEqual([
      'GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'AM', 'ST',
    ]);
    expect(positionLabels('4-5-1')).toEqual([
      'GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'CM', 'LM', 'ST',
    ]);
  });

  it('yields 11 allowed labels for every eligible formation', () => {
    for (const lineup of FAMOUS_LINEUPS.filter(isTeamsheetLineup)) {
      const labels = positionLabels(lineup.formation);
      expect({id: lineup.id, count: labels.length}).toEqual({id: lineup.id, count: 11});
      for (const label of labels) {
        expect(ALLOWED.has(label)).toBe(true);
      }
    }
  });
});
