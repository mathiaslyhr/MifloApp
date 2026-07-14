import {ageOn, compareAttributes, compareCell, deriveAttributes} from '../compare';
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
    born: '1998-06-15',
    clubs: [{clubId: 'chelsea', from: 2018}],
    honours: [],
    ...overrides,
  };
}

/** The puzzle day every comparison in this file runs on. */
const DATE_KEY = '2026-07-09';

const derive = (f: Footballer) => deriveAttributes(f, DATE_KEY);

const status = (row: ReturnType<typeof compareAttributes>, key: ColumnKey): CellStatus =>
  row.find(c => c.key === key)!.status;
const dir = (row: ReturnType<typeof compareAttributes>, key: ColumnKey) =>
  row.find(c => c.key === key)!.direction;

describe('ageOn', () => {
  it('counts whole years, flipping exactly on the birthday', () => {
    expect(ageOn('2026-06-14', '1998-06-15')).toBe(27); // day before
    expect(ageOn('2026-06-15', '1998-06-15')).toBe(28); // the birthday itself
    expect(ageOn('2026-06-16', '1998-06-15')).toBe(28); // day after
  });

  it('is undefined for a malformed date of birth', () => {
    expect(ageOn(DATE_KEY, 'unknown')).toBeUndefined();
  });
});

describe('deriveAttributes', () => {
  it('picks the open-ended spell as the active club and its league', () => {
    const d = derive(
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
    const d = derive(
      footballer({
        clubs: [
          {clubId: 'aston-villa', from: 2015, to: 2018},
          {clubId: 'chelsea', from: 2018, to: 2025},
        ],
      }),
    );
    expect(d.activeClubId).toBe('chelsea');
    expect(d.league).toBe('premier-league');
  });

  it('has no active club only when there are no clubs at all', () => {
    const d = derive(footballer({clubs: []}));
    expect(d.activeClubId).toBeUndefined();
    expect(d.league).toBeUndefined();
  });

  it('computes the age at the puzzle date', () => {
    expect(derive(footballer({born: '1998-06-15'})).age).toBe(28);
    expect(derive(footballer({born: '1998-08-15'})).age).toBe(27); // birthday later this year
  });
});

describe('compareAttributes', () => {
  it('marks every column hit for an identical player', () => {
    const f = footballer();
    const row = compareAttributes(derive(f), derive(f));
    expect(row.every(c => c.status === 'hit')).toBe(true);
  });

  it('nationality: equal hit, shared dual partial, disjoint miss', () => {
    const secret = derive(footballer({nationality: ['France']}));
    expect(
      status(
        compareAttributes(derive(footballer({nationality: ['France']})), secret),
        'nationality',
      ),
    ).toBe('hit');
    expect(
      status(
        compareAttributes(
          derive(footballer({nationality: ['France', 'Cameroon']})),
          secret,
        ),
        'nationality',
      ),
    ).toBe('partial');
    expect(
      status(
        compareAttributes(derive(footballer({nationality: ['Brazil']})), secret),
        'nationality',
      ),
    ).toBe('miss');
  });

  it('club: exact club hit, any other club miss (even same league)', () => {
    const secret = derive(footballer({clubs: [{clubId: 'chelsea', from: 2018}]}));
    expect(
      status(
        compareAttributes(
          derive(footballer({clubs: [{clubId: 'chelsea', from: 2018}]})),
          secret,
        ),
        'club',
      ),
    ).toBe('hit');
    // Same league (arsenal = premier-league) is still a miss — League carries that.
    expect(
      status(
        compareAttributes(
          derive(footballer({clubs: [{clubId: 'arsenal', from: 2018}]})),
          secret,
        ),
        'club',
      ),
    ).toBe('miss');
    expect(
      status(
        compareAttributes(
          derive(footballer({clubs: [{clubId: 'ac-milan', from: 2018}]})),
          secret,
        ),
        'club',
      ),
    ).toBe('miss');
  });

  it('club: yellow when the guess plays at a former club of the secret', () => {
    // Secret came up at arsenal, now at chelsea.
    const secret = derive(
      footballer({
        clubs: [
          {clubId: 'arsenal', from: 2012, to: 2018},
          {clubId: 'chelsea', from: 2018},
        ],
      }),
    );
    // Guess currently at arsenal (a former club of the secret) = yellow.
    expect(
      status(
        compareAttributes(
          derive(footballer({clubs: [{clubId: 'arsenal', from: 2020}]})),
          secret,
        ),
        'club',
      ),
    ).toBe('partial');
    // Guess currently at chelsea (the secret's current club) still wins green.
    expect(
      status(
        compareAttributes(
          derive(footballer({clubs: [{clubId: 'chelsea', from: 2020}]})),
          secret,
        ),
        'club',
      ),
    ).toBe('hit');
    // A club the secret never played at stays grey.
    expect(
      status(
        compareAttributes(
          derive(footballer({clubs: [{clubId: 'ac-milan', from: 2020}]})),
          secret,
        ),
        'club',
      ),
    ).toBe('miss');
  });

  it('club: a loan spell still counts as having played there (yellow)', () => {
    const secret = derive(
      footballer({
        clubs: [
          {clubId: 'ac-milan', from: 2016, to: 2017, loan: true},
          {clubId: 'chelsea', from: 2017},
        ],
      }),
    );
    expect(
      status(
        compareAttributes(
          derive(footballer({clubs: [{clubId: 'ac-milan', from: 2020}]})),
          secret,
        ),
        'club',
      ),
    ).toBe('partial');
  });

  it('league: green for current, yellow for a former league, grey otherwise', () => {
    // Secret played in serie-a (ac-milan), now premier-league (chelsea).
    const secret = derive(
      footballer({
        clubs: [
          {clubId: 'ac-milan', from: 2014, to: 2019},
          {clubId: 'chelsea', from: 2019},
        ],
      }),
    );
    // Guess in the current league (arsenal = premier-league) = green.
    expect(
      status(
        compareAttributes(
          derive(footballer({clubs: [{clubId: 'arsenal', from: 2020}]})),
          secret,
        ),
        'league',
      ),
    ).toBe('hit');
    // Guess in a former league (ac-milan = serie-a) = yellow.
    expect(
      status(
        compareAttributes(
          derive(footballer({clubs: [{clubId: 'ac-milan', from: 2020}]})),
          secret,
        ),
        'league',
      ),
    ).toBe('partial');
  });

  it('age: same age hit, and arrows point toward the secret', () => {
    const secret = derive(footballer({born: '1996-03-01'})); // 30 on DATE_KEY
    // Different birthday, same whole-year age = hit.
    expect(status(compareAttributes(derive(footballer({born: '1996-05-20'})), secret), 'age')).toBe('hit');
    const younger = compareAttributes(derive(footballer({born: '2003-03-01'})), secret);
    expect(status(younger, 'age')).toBe('miss');
    expect(dir(younger, 'age')).toBe('up'); // secret 30 > guess 23
    const older = compareAttributes(derive(footballer({born: '1988-03-01'})), secret);
    expect(dir(older, 'age')).toBe('down');
  });

  it('numeric columns miss without direction when a value is missing', () => {
    const secret = derive(footballer());
    const guess = derive(footballer({born: 'unknown'}));
    const cell = compareCell('age', guess, secret);
    expect(cell.status).toBe('miss');
    expect(cell.direction).toBeUndefined();
  });
});
