import {compareAttributes, compareCell, deriveAttributes} from '../compare';
import type {Footballer} from '../../../data/football';
import type {CellStatus, ColumnKey} from '../types';

/**
 * Fixtures use REAL club ids (chelsea/arsenal = premier-league, ac-milan =
 * serie-a) so `getClub` resolves the league for the club/league columns.
 */
function footballer(overrides: Partial<Footballer> = {}): Footballer {
  return {
    id: 'test',
    name: 'Test Player',
    nationality: ['England'],
    positions: ['FW'],
    shirtNumbers: [9],
    clubs: [{clubId: 'chelsea', from: 2018}],
    honours: [],
    ...overrides,
  };
}

const status = (row: ReturnType<typeof compareAttributes>, key: ColumnKey): CellStatus =>
  row.find(c => c.key === key)!.status;
const dir = (row: ReturnType<typeof compareAttributes>, key: ColumnKey) =>
  row.find(c => c.key === key)!.direction;

describe('deriveAttributes', () => {
  it('picks the open-ended spell as the active club and its league', () => {
    const d = deriveAttributes(
      footballer({
        clubs: [
          {clubId: 'aston-villa', from: 2015, to: 2018},
          {clubId: 'chelsea', from: 2018},
        ],
      }),
    );
    expect(d.activeClubId).toBe('chelsea');
    expect(d.league).toBe('premier-league');
  });

  it('falls back to the most recent spell when none is open-ended', () => {
    // Current players often have their current spell end-dated (e.g. to: 2025),
    // so the last spell is treated as the current club.
    const d = deriveAttributes(
      footballer({
        clubs: [
          {clubId: 'aston-villa', from: 2015, to: 2018},
          {clubId: 'chelsea', from: 2018, to: 2025},
        ],
        shirtNumbers: undefined,
      }),
    );
    expect(d.activeClubId).toBe('chelsea');
    expect(d.league).toBe('premier-league');
    expect(d.shirtNumber).toBeUndefined();
  });

  it('has no active club only when there are no clubs at all', () => {
    const d = deriveAttributes(footballer({clubs: []}));
    expect(d.activeClubId).toBeUndefined();
    expect(d.league).toBeUndefined();
  });
});

describe('compareAttributes', () => {
  it('marks every column hit for an identical player', () => {
    const f = footballer();
    const row = compareAttributes(deriveAttributes(f), deriveAttributes(f));
    expect(row.every(c => c.status === 'hit')).toBe(true);
  });

  it('nationality: equal hit, shared dual partial, disjoint miss', () => {
    const secret = deriveAttributes(footballer({nationality: ['France']}));
    expect(
      status(
        compareAttributes(deriveAttributes(footballer({nationality: ['France']})), secret),
        'nationality',
      ),
    ).toBe('hit');
    expect(
      status(
        compareAttributes(
          deriveAttributes(footballer({nationality: ['France', 'Cameroon']})),
          secret,
        ),
        'nationality',
      ),
    ).toBe('partial');
    expect(
      status(
        compareAttributes(deriveAttributes(footballer({nationality: ['Brazil']})), secret),
        'nationality',
      ),
    ).toBe('miss');
  });

  it('club: exact club hit, any other club miss (even same league)', () => {
    const secret = deriveAttributes(footballer({clubs: [{clubId: 'chelsea', from: 2018}]}));
    expect(
      status(
        compareAttributes(
          deriveAttributes(footballer({clubs: [{clubId: 'chelsea', from: 2018}]})),
          secret,
        ),
        'club',
      ),
    ).toBe('hit');
    // Same league (arsenal = premier-league) is still a miss — League carries that.
    expect(
      status(
        compareAttributes(
          deriveAttributes(footballer({clubs: [{clubId: 'arsenal', from: 2018}]})),
          secret,
        ),
        'club',
      ),
    ).toBe('miss');
    expect(
      status(
        compareAttributes(
          deriveAttributes(footballer({clubs: [{clubId: 'ac-milan', from: 2018}]})),
          secret,
        ),
        'club',
      ),
    ).toBe('miss');
  });

  it('shirt number: hit, and arrows point toward the secret', () => {
    const secret = deriveAttributes(footballer({shirtNumbers: [10]}));
    expect(status(compareAttributes(deriveAttributes(footballer({shirtNumbers: [10]})), secret), 'shirtNumber')).toBe('hit');
    const lower = compareAttributes(deriveAttributes(footballer({shirtNumbers: [7]})), secret);
    expect(status(lower, 'shirtNumber')).toBe('miss');
    expect(dir(lower, 'shirtNumber')).toBe('up'); // secret 10 > guess 7
    const higher = compareAttributes(deriveAttributes(footballer({shirtNumbers: [23]})), secret);
    expect(dir(higher, 'shirtNumber')).toBe('down');
  });

  it('numeric columns miss without direction when a value is missing', () => {
    const secret = deriveAttributes(footballer({shirtNumbers: [10]}));
    const guess = deriveAttributes(footballer({shirtNumbers: undefined}));
    const cell = compareCell('shirtNumber', guess, secret);
    expect(cell.status).toBe('miss');
    expect(cell.direction).toBeUndefined();
  });
});
