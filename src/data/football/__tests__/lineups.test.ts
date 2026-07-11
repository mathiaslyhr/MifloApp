/**
 * @format
 */
import {COMPETITION_KEYS, FAMOUS_LINEUPS, FOOTBALLERS, getById, isTeamsheetLineup} from '..';
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

/** Legacy players still missing from FOOTBALLERS — may only shrink. */
const KNOWN_MISSING: string[] = [
  'Abedi Pelé',
  'Adrien Silva',
  'Albert Ferrer',
  'Aldair',
  'Alen Bokšić',
  'Alexander Hleb',
  'Anatoliy Tymoshchuk',
  'Anderson',
  'Andoni Zubizarreta',
  'Andrea Barzagli',
  'Andreas Brehme',
  'Andreas Möller',
  'Angelo Peruzzi',
  'Angelos Basinas',
  'Angelos Charisteas',
  'Antonio Benarrivo',
  'Antonio Conte',
  'Antonio Valencia',
  'Antonios Nikopolidis',
  'Arne Friedrich',
  'Augusto Fernández',
  'Bacary Sagna',
  'Basile Boli',
  'Bebeto',
  'Ben Chilwell',
  'Benedikt Höwedes',
  'Bernd Schneider',
  'Bixente Lizarazu',
  'Blaise Matuidi',
  'Bodo Illgner',
  'Boudewijn Zenden',
  'Branco',
  'Brian Laudrup',
  'Carlos Marchena',
  'Carsten Ramelow',
  'Charles Aránguiz',
  'Chris Smalling',
  'Christian Karembeu',
  'Christian Panucci',
  'Christoph Kramer',
  'Christoph Metzelder',
  'Christophe Dugarry',
  'Ciro Ferrara',
  'Claudio Marchisio',
  'Cédric Soares',
  'César Sampaio',
  'César Sánchez',
  'Daley Blind',
  'Dani Carvajal',
  'Daniel Agger',
  'Daniele De Rossi',
  'Daniele Massaro',
  'Danijel Subašić',
  'Danny Blind',
  'Danny Rose',
  'Dejan Savićević',
  'Demetrio Albertini',
  'Dida',
  'Diego Contento',
  'Dietmar Hamann',
  'Dimitri Payet',
  'Dino Baggio',
  'Djimi Traoré',
  'Domagoj Vida',
  'Dunga',
  'Edmílson',
  'Eduardo Vargas',
  'Emmanuel Eboué',
  'Everton',
  'Ezequiel Garay',
  'Ezequiel Lavezzi',
  'Fabien Barthez',
  'Fabio Grosso',
  'Fabrizio Ravanelli',
  'Ferland Mendy',
  'Filippo Galli',
  'Finidi George',
  'Flemming Povlsen',
  'Florent Malouda',
  'Francesco Toldo',
  'Francisco Silva',
  'Franck Sauzée',
  'Frank Lebœuf',
  'Frank Rijkaard',
  'Frank de Boer',
  'Freddie Ljungberg',
  'Gabi',
  'Gianluca Pagliuca',
  'Gianluca Pessotto',
  'Gianluca Vialli',
  'Gilberto Silva',
  'Giourkas Seitaridis',
  'Giovanni van Bronckhorst',
  'Guido Buchwald',
  'Harry Kewell',
  'Harry Maguire',
  'Harry Winks',
  'Henrik Larsen',
  'Hugo Lloris',
  'Ignazio Abate',
  'Ivan Strinić',
  'Iván Helguera',
  'Jean Beausejour',
  'Jean-Jacques Eydelie',
  'Jens Jeremies',
  'Jens Lehmann',
  'Jermaine Pennant',
  'Jerzy Dudek',
  'Jesper Blomqvist',
  'Joan Capdevila',
  'Jocelyn Angloma',
  'John Arne Riise',
  'John Heitinga',
  'John Jensen',
  "John O'Shea",
  'John Obi Mikel',
  'John Sivebæk',
  'Jorge Valdivia',
  'Joris Mathijsen',
  'José Bosingwa',
  'José Mari Bakero',
  'Joël Matip',
  'Juan Carlos',
  'Juanfran',
  'Julio Salinas',
  'Jörg Heinrich',
  'Júnior Baiano',
  'Jürgen Kohler',
  'Kalvin Phillips',
  'Karl-Heinz Riedle',
  'Kent Nielsen',
  'Kim Christofte',
  'Kim Vilfort',
  'Klaus Augenthaler',
  'Kléberson',
  'Kolo Touré',
  'Kostas Katsouranis',
  'Lars Olsen',
  'Laurent Blanc',
  'Laurent Koscielny',
  'Leonardo',
  'Loris Karius',
  'Luca Toni',
  'Lucas Biglia',
  'Ludovic Giuly',
  'Luigi Di Biagio',
  'Luis García',
  'Luke Shaw',
  'Maarten Stekelenburg',
  'Manolo Sanchís',
  'Marcel Desailly',
  'Marcelo Díaz',
  'Marco Bode',
  'Marco Delvecchio',
  'Marcos',
  'Marcos Acuña',
  'Marcos Senna',
  'Marek Jankulovski',
  'Mark Iuliano',
  'Martin Kree',
  'Massimo Ambrosini',
  'Massimo Oddo',
  'Mauricio Isla',
  'Mauro Camoranesi',
  'Mauro Silva',
  'Mauro Tassotti',
  'Mazinho',
  'Michael Reiziger',
  'Michalis Kapsis',
  'Milan Baroš',
  'Moreno Torricelli',
  'Márcio Santos',
  'Míchel Salgado',
  'Nacho',
  'Nando',
  'Nicky Butt',
  'Nicola Berti',
  'Nigel de Jong',
  'Oleguer',
  'Oliver Neuville',
  'Owen Hargreaves',
  'Paul Lambert',
  'Paulo Sousa',
  'Pep Guardiola',
  'Per Mertesacker',
  'Pierre Littbarski',
  'Pietro Vierchowod',
  'Predrag Mijatović',
  'Presnel Kimpembe',
  'Rafael Márquez',
  'Raphaël Guerreiro',
  'Renato Sanches',
  'Riccardo Montolivo',
  'Roberto Donadoni',
  'Roberto Mussi',
  'Ronald Koeman',
  'Ronald de Boer',
  'Ronny Johnsen',
  'Roque Júnior',
  'Rudi Völler',
  'Salomon Kalou',
  'Sami Hyypiä',
  'Samuel Umtiti',
  'Santiago Solari',
  'Sebastiano Rossi',
  'Sergio Romero',
  'Simone Perrotta',
  'Stefan Klos',
  'Stefan Reuter',
  'Stefano Fiore',
  'Stelios Giannakopoulos',
  'Stephan Lichtsteiner',
  'Steve Finnan',
  'Stéphane Chapuisat',
  'Stéphane Guivarc’h',
  'Sylvinho',
  'Taffarel',
  'Takis Fyssas',
  'Theodoros Zagorakis',
  'Thomas Berthold',
  'Thomas Hitzlsperger',
  'Thomas Häßler',
  'Thomas Linke',
  'Torben Piechnik',
  'Torsten Frings',
  'Traianos Dellas',
  'Wes Brown',
  'William Carvalho',
  'William Gallas',
  'Willy Sagnol',
  'Zinho',
  'Zisis Vryzas',
  'Zvonimir Boban',
  'Álvaro Arbeloa',
  'Šime Vrsaljko',
];

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

  it('every eligible lineup player resolves in the footballers dataset', () => {
    // Autocomplete suggests from FOOTBALLERS, so a lineup player missing there
    // is guessable only by exact typing. New lineups must ship with their XI
    // fully in the dataset; KNOWN_MISSING is the legacy backlog being worked
    // down in batches and may only shrink — delete it when it hits zero.
    const known = new Set<string>();
    for (const f of FOOTBALLERS) {
      known.add(fold(f.name));
      if (f.fullName) {
        known.add(fold(f.fullName));
      }
      for (const nickname of f.nicknames ?? []) {
        known.add(fold(nickname));
      }
    }
    const missing = new Set<string>();
    for (const lineup of ELIGIBLE) {
      for (const player of lineup.players) {
        const resolves =
          player.footballerId !== undefined ||
          [player.name, ...(player.aliases ?? [])].some(n => known.has(fold(n)));
        if (!resolves) {
          missing.add(player.name);
        }
      }
    }
    const allowed = new Set(KNOWN_MISSING);
    const newGaps = [...missing].filter(n => !allowed.has(n)).sort();
    const staleAllowlist = KNOWN_MISSING.filter(n => !missing.has(n));
    expect(newGaps).toEqual([]);
    expect(staleAllowlist).toEqual([]);
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
