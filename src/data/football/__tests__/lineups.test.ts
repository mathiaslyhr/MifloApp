/**
 * @format
 */
import {FAMOUS_LINEUPS, getById} from '..';
import type {Position} from '../types';

const POSITIONS: Position[] = ['GK', 'DF', 'MF', 'FW'];

describe('famous lineups integrity', () => {
  it('every lineup has exactly 11 players', () => {
    for (const lineup of FAMOUS_LINEUPS) {
      expect(lineup.players).toHaveLength(11);
    }
  });

  it('every lineup has exactly one goalkeeper', () => {
    for (const lineup of FAMOUS_LINEUPS) {
      const keepers = lineup.players.filter(p => p.position === 'GK');
      expect(keepers).toHaveLength(1);
    }
  });

  it('every player has a valid position and a non-empty name', () => {
    for (const lineup of FAMOUS_LINEUPS) {
      for (const player of lineup.players) {
        expect(POSITIONS).toContain(player.position);
        expect(player.name.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('lineup ids are unique', () => {
    const ids = FAMOUS_LINEUPS.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('formation digits cover the ten outfield players', () => {
    for (const lineup of FAMOUS_LINEUPS) {
      const sum = lineup.formation
        .split('-')
        .map(n => parseInt(n, 10))
        .reduce((a, b) => a + b, 0);
      expect(sum).toBe(10); // + 1 keeper = 11
    }
  });

  it('any footballerId link resolves to a real footballer', () => {
    for (const lineup of FAMOUS_LINEUPS) {
      for (const player of lineup.players) {
        if (player.footballerId) {
          expect(getById(player.footballerId)).toBeDefined();
        }
      }
    }
  });
});
