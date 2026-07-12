import {fold, foldSearch, scoreFootballer, searchPlayers} from '../playerSearch';
import type {Footballer} from '../../../data/football';

function player(id: string, name: string, extra: Partial<Footballer> = {}): Footballer {
  return {id, name, nationality: [], positions: ['FW'], born: '2000-01-01', clubs: [], honours: [], ...extra};
}

const gavi = player('Gavi', 'Gavi');
const griezmann = player('Griezmann, Antoine', 'Antoine Griezmann');
const adingra = player('Adingra, Simon', 'Simon Adingra');
const joao = player('Félix, João', 'João Félix');
const ronaldo9 = player('Ronaldo', 'Ronaldo', {nicknames: ['R9', 'Ronaldo Nazário', 'O Fenômeno']});

const POOL = [adingra, gavi, griezmann, joao, ronaldo9];

describe('fold', () => {
  it('strips accents and lowercases', () => {
    expect(fold('João Félix')).toBe('joao felix');
    expect(fold('Müller')).toBe('muller');
  });

  it('foldSearch also folds atomic letters NFD leaves alone (ı, ø, ł, ß…)', () => {
    expect(foldSearch('Yılmaz')).toBe('yilmaz'); // so "yi" matches
    expect(foldSearch('Ødegaard')).toBe('odegaard');
    expect(foldSearch('Lewandowłski')).toBe('lewandowlski');
    expect(foldSearch('Weiß')).toBe('weiss');
    expect(foldSearch('Guðmundsson')).toBe('gudmundsson');
    // Base fold leaves them alone (curated alias tables depend on this).
    expect(fold('Yılmaz')).toBe('yılmaz');
  });
});

describe('scoreFootballer / searchPlayers ranking', () => {
  it('ranks name-prefix matches above mid-word substring matches for "g"', () => {
    const out = searchPlayers(POOL, 'g');
    // Gavi (name prefix) and Griezmann (token prefix) come before Adingra (substring).
    expect(out.indexOf(gavi)).toBeLessThan(out.indexOf(adingra));
    expect(out.indexOf(griezmann)).toBeLessThan(out.indexOf(adingra));
    expect(scoreFootballer(gavi, 'g')).toBeGreaterThan(scoreFootballer(adingra, 'g'));
  });

  it('matches accented names from plain-ASCII input', () => {
    // "o" should surface João Félix at all (old substring search on "ó" failed).
    expect(searchPlayers(POOL, 'joao')).toContain(joao);
    expect(scoreFootballer(joao, 'joao')).toBeGreaterThan(0);
  });

  it('finds players by known nickname', () => {
    expect(searchPlayers(POOL, 'r9')).toContain(ronaldo9);
    expect(searchPlayers(POOL, 'fenomeno')).toContain(ronaldo9);
  });

  it('excludes already-used players and empty queries', () => {
    expect(searchPlayers(POOL, 'g', ['Gavi'])).not.toContain(gavi);
    expect(searchPlayers(POOL, '   ')).toEqual([]);
  });
});
