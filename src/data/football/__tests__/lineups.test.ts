/**
 * @format
 */
import {COMPETITION_KEYS, FAMOUS_LINEUPS, getById, isTeamsheetLineup} from '..';
import {fold} from '../../../games/hattrick/playerSearch';
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

/**
 * Team sheet enrichment integrity — runs over the eligible subset only, so
 * unenriched legacy entries stay valid while the pool grows.
 */
describe('teamsheet lineups', () => {
  const ELIGIBLE = FAMOUS_LINEUPS.filter(isTeamsheetLineup);

  it('has an eligible pool', () => {
    expect(ELIGIBLE.length).toBeGreaterThanOrEqual(20);
  });

  it('a lineup with match context is fully enriched', () => {
    // `match` present but a missing shirt/captain means a half-done entry —
    // it would silently drop out of the pool, so fail loudly instead. Checked
    // directly (not via isTeamsheetLineup) so pre-1990 entries, which are
    // enriched but year-gated out of the pool, stay covered.
    for (const lineup of FAMOUS_LINEUPS) {
      if (lineup.match) {
        const enriched =
          lineup.players.length === 11 &&
          lineup.players.every(p => p.shirt !== undefined) &&
          lineup.players.filter(p => p.captain).length === 1;
        expect({id: lineup.id, enriched}).toEqual({id: lineup.id, enriched: true});
      }
    }
  });

  it('the goalkeeper leads the players array', () => {
    for (const lineup of ELIGIBLE) {
      expect(lineup.players[0].position).toBe('GK');
    }
  });

  it('shirt numbers are unique within the XI and in 1-99', () => {
    for (const lineup of ELIGIBLE) {
      const shirts = lineup.players.map(p => p.shirt!);
      expect(new Set(shirts).size).toBe(11);
      for (const shirt of shirts) {
        expect(shirt).toBeGreaterThanOrEqual(1);
        expect(shirt).toBeLessThanOrEqual(99);
      }
    }
  });

  it('goals and assists balance against the score', () => {
    for (const lineup of ELIGIBLE) {
      const {goalsFor, oppOwnGoals = 0} = lineup.match!;
      const goals = lineup.players.reduce((n, p) => n + (p.goals ?? 0), 0);
      const assists = lineup.players.reduce((n, p) => n + (p.assists ?? 0), 0);
      // Subs may account for the rest; the XI can never exceed the score.
      expect(goals + oppOwnGoals).toBeLessThanOrEqual(goalsFor);
      expect(assists).toBeLessThanOrEqual(goalsFor);
    }
  });

  it('shootout fields come in pairs and only after a draw', () => {
    for (const lineup of ELIGIBLE) {
      const {goalsFor, goalsAgainst, pensFor, pensAgainst} = lineup.match!;
      expect(pensFor === undefined).toBe(pensAgainst === undefined);
      if (pensFor !== undefined) {
        expect(goalsFor).toBe(goalsAgainst);
      }
    }
  });

  it('kit colours are well-formed hex and present on every eligible lineup', () => {
    const HEX = /^#[0-9A-F]{6}$/i;
    for (const lineup of ELIGIBLE) {
      expect({id: lineup.id, hasKit: lineup.kit !== undefined}).toEqual({
        id: lineup.id,
        hasKit: true,
      });
      const {body, number, gkBody, gkNumber} = lineup.kit!;
      for (const colour of [body, number, gkBody, gkNumber]) {
        if (colour !== undefined) {
          expect(colour).toMatch(HEX);
        }
      }
    }
  });

  it('match context is coherent', () => {
    for (const lineup of ELIGIBLE) {
      const match = lineup.match!;
      expect(COMPETITION_KEYS).toContain(match.competitionKey);
      expect(match.opponent.trim().length).toBeGreaterThan(0);
      expect(match.opponent).not.toBe(lineup.team);
      expect(match.goalsFor).toBeGreaterThanOrEqual(0);
      expect(match.goalsAgainst).toBeGreaterThanOrEqual(0);
    }
  });

  it('no accepted answer token maps to two players in one XI', () => {
    // Mirrors the engine's acceptedTokens rules: full name + aliases always;
    // the bare surname only when unique. A collision would make a typed guess
    // ambiguous between two slots.
    for (const lineup of ELIGIBLE) {
      const owners = new Map<string, number>();
      const claim = (token: string, slot: number) => {
        const existing = owners.get(token);
        expect({id: lineup.id, token, clash: existing ?? slot}).toEqual({
          id: lineup.id,
          token,
          clash: slot,
        });
        owners.set(token, slot);
      };
      const surnames = lineup.players.map(p => {
        const tokens = fold(p.name).split(/\s+/);
        return tokens[tokens.length - 1];
      });
      lineup.players.forEach((player, slot) => {
        claim(fold(player.name), slot);
        for (const alias of player.aliases ?? []) {
          claim(fold(alias), slot);
        }
      });
      lineup.players.forEach((player, slot) => {
        const surname = surnames[slot];
        if (surnames.filter(s => s === surname).length === 1) {
          const existing = owners.get(surname);
          // A unique surname may coincide with its own player's tokens only.
          if (existing !== undefined) {
            expect({id: lineup.id, surname, owner: existing}).toEqual({
              id: lineup.id,
              surname,
              owner: slot,
            });
          }
        }
      });
    }
  });
});
