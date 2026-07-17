import {FAMOUS_LINEUPS, isTeamsheetLineup} from '../../../data/football';
import {teamArt} from '../teamArt';

/**
 * Every team that can front a Team sheet daily must resolve to a real crest or
 * flag — otherwise its Home lead silently degrades to a kit-colour disc. If a
 * new lineup adds a club whose slug doesn't match, this fails and points at the
 * CLUB_SLUG map in teamArt.ts.
 */
describe('teamArt coverage', () => {
  const teams = Array.from(
    new Set(FAMOUS_LINEUPS.filter(isTeamsheetLineup).map(l => l.team)),
  );

  it('resolves every Team sheet team to a crest or flag', () => {
    const unresolved = teams.filter(t => teamArt(t) === null);
    expect(unresolved).toEqual([]);
  });
});
