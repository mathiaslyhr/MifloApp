/**
 * Football facts generated from the curated dataset — one-line statements for
 * dead time in the UI (today: the ranked matchmaking queue).
 *
 * Two rules hold every template here together:
 *
 * 1. A fact states something about ONE row and never a superlative. No "the
 *    only player to…", no "has won the most…". The dataset is curated, not
 *    exhaustive, so any claim that depends on completeness ACROSS players is a
 *    lie waiting for the next data edit. Statements about a single player's own
 *    curated career are safe, because that career is maintained as complete.
 * 2. Copy is never baked in English: a Fact is an i18n key plus params, the
 *    same shape Offside's `Explanation` uses. Enum-ish values (honour types) go
 *    in the KEY so both languages can phrase them naturally — `HONOUR_LABELS`
 *    in types.ts is English-only by design and must not be interpolated.
 *
 * A template returns null when a row lacks the fields it needs; the generator
 * simply tries again. That is why nothing here reads `clubs[].goals`,
 * `clubs[].appearances` or `seasonStats` — those are populated for a handful of
 * rows, so a "scored N goals for X" fact would almost never fire.
 */
import {getClub} from './clubs';
import {derivedFromData} from './generation';
import {MANAGERS} from './managers';
import {
  clubCountriesOf,
  find,
  getById,
  matches,
  pickRandom,
  sharedClubsOf,
  shuffle,
  type Rng,
} from './repository';
import {TREBLE_SQUADS} from './trebles';
import type {Footballer, HonourType} from './types';

/** An i18n key plus its interpolation params. Never a rendered string. */
export type Fact = {key: string; params: Record<string, string | number>};

type Template = (rng: Rng) => Fact | null;

/**
 * Honours worth naming with a single year. League titles and domestic cups are
 * excluded (meaningless without a club — see `leagueTitle` below), as are the
 * Golden Boot and Player of the Season, which don't say which competition.
 */
const YEAR_HONOURS: readonly HonourType[] = [
  'champions-league',
  'europa-league',
  'world-cup',
  'european-championship',
  'ballon-dor',
  'copa-america',
];

/**
 * Facts are only interesting about players people recognise, so subjects come
 * from the tagged players rather than the whole dataset.
 */
const famousPool = derivedFromData((): readonly Footballer[] => {
  const seen = new Set<string>();
  const out: Footballer[] = [];
  for (const tag of ['legends', 'current-stars']) {
    for (const f of find([{kind: 'tag', tag}])) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        out.push(f);
      }
    }
  }
  return out;
});

const famousIds = derivedFromData(
  (): ReadonlySet<string> => new Set(famousPool().map(f => f.id)),
);

const legendsPool = derivedFromData(
  (): readonly Footballer[] => find([{kind: 'tag', tag: 'legends'}]),
);

/**
 * How many of an honour a player has won, totalled across entries. Club honours
 * are stored per club (a league title at each of two clubs is two entries), so
 * reading a single entry would understate the total.
 */
function honourTotal(footballer: Footballer, type: HonourType): number {
  let total = 0;
  for (const h of footballer.honours) {
    if (h.type === type) {
      total += h.count ?? h.years?.length ?? 0;
    }
  }
  return total;
}

/** The distinct honour types a player holds. */
function honourTypesOf(footballer: Footballer): HonourType[] {
  return [...new Set(footballer.honours.map(h => h.type))];
}

/** "Modrić has won the Champions League 6 times." */
const honourCount: Template = rng => {
  const f = pickRandom(famousPool(), rng);
  if (!f) {
    return null;
  }
  const type = pickRandom(
    honourTypesOf(f).filter(h => honourTotal(f, h) >= 2),
    rng,
  );
  if (!type) {
    return null;
  }
  // `times`, not `count`: a param named `count` makes i18next resolve plural
  // forms (`key_plural`) that these keys deliberately don't define.
  return {
    key: `rankedHattrick.fact.honourCount.${type}`,
    params: {name: f.name, times: honourTotal(f, type)},
  };
};

/** "Iniesta won the World Cup in 2010." */
const honourYear: Template = rng => {
  const f = pickRandom(famousPool(), rng);
  if (!f) {
    return null;
  }
  const honour = pickRandom(
    f.honours.filter(h => YEAR_HONOURS.includes(h.type) && h.years?.length),
    rng,
  );
  const year = honour && pickRandom(honour.years ?? [], rng);
  if (!honour || year == null) {
    return null;
  }
  return {
    key: `rankedHattrick.fact.honourYear.${honour.type}`,
    params: {name: f.name, year},
  };
};

/** "Kanté won the league with Leicester in 2016." */
const leagueTitle: Template = rng => {
  const f = pickRandom(famousPool(), rng);
  if (!f) {
    return null;
  }
  const honour = pickRandom(
    f.honours.filter(h => h.type === 'league-title' && h.clubId && h.years?.length),
    rng,
  );
  const year = honour && pickRandom(honour.years ?? [], rng);
  const club = honour?.clubId ? getClub(honour.clubId) : undefined;
  if (!club || year == null) {
    return null;
  }
  return {
    key: 'rankedHattrick.fact.leagueTitle',
    params: {name: f.name, club: club.name, year},
  };
};

/**
 * "Maldini never played for a club other than Milan."
 *
 * Legends only: a 19-year-old with one club so far is technically a one-club
 * player, but it isn't a fact — it's a fact that expires. Any loan spell
 * disqualifies too, since a loan IS another club.
 */
const oneClub: Template = rng => {
  const f = pickRandom(legendsPool(), rng);
  if (!f || !matches(f, {kind: 'oneClub'}) || f.clubs.some(s => s.loan)) {
    return null;
  }
  const club = getClub(f.clubs[0]?.clubId ?? '');
  if (!club) {
    return null;
  }
  return {
    key: 'rankedHattrick.fact.oneClub',
    params: {name: f.name, club: club.name},
  };
};

/** "Xavi was part of the Barcelona treble side of 2008-09." */
const treble: Template = rng => {
  const squad = pickRandom(TREBLE_SQUADS, rng);
  if (!squad) {
    return null;
  }
  const id = pickRandom(squad.playerIds, rng);
  const f = id ? getById(id) : undefined;
  const club = getClub(squad.clubId);
  if (!f || !club) {
    return null;
  }
  return {
    key: 'rankedHattrick.fact.treble',
    params: {name: f.name, club: club.name, season: squad.season},
  };
};

/** "Henry and Alves were teammates at Barcelona." */
const teammates: Template = rng => {
  const a = pickRandom(famousPool(), rng);
  if (!a) {
    return null;
  }
  const b = pickRandom(
    find([{kind: 'teammate', playerId: a.id}]).filter(f => famousIds().has(f.id)),
    rng,
  );
  const clubId = b && pickRandom(sharedClubsOf(a, b), rng);
  const club = clubId ? getClub(clubId) : undefined;
  if (!b || !club) {
    return null;
  }
  return {
    key: 'rankedHattrick.fact.teammates',
    params: {a: a.name, b: b.name, club: club.name},
  };
};

/** "Ibrahimović played for clubs in 5 different countries." */
const careerCountries: Template = rng => {
  const f = pickRandom(famousPool(), rng);
  if (!f) {
    return null;
  }
  const count = clubCountriesOf(f).length;
  if (count < 3) {
    return null;
  }
  return {
    key: 'rankedHattrick.fact.careerCountries',
    params: {name: f.name, countries: count},
  };
};

/** "Guardiola managed Bayern from 2013 to 2016." */
const managerSpell: Template = (rng): Fact | null => {
  const m = pickRandom(MANAGERS, rng);
  if (!m) {
    return null;
  }
  const spell = pickRandom(
    m.spells.filter(s => s.clubId != null),
    rng,
  );
  const club = spell?.clubId ? getClub(spell.clubId) : undefined;
  if (!spell || !club) {
    return null;
  }
  if (spell.to == null) {
    return {
      key: 'rankedHattrick.fact.managerSpellCurrent',
      params: {name: m.name, club: club.name, from: spell.from},
    };
  }
  return {
    key: 'rankedHattrick.fact.managerSpell',
    params: {name: m.name, club: club.name, from: spell.from, to: spell.to},
  };
};

const TEMPLATES: readonly Template[] = [
  honourCount,
  honourYear,
  leagueTitle,
  oneClub,
  treble,
  teammates,
  careerCountries,
  managerSpell,
];

/** The player a fact is about — used to keep one batch from repeating a name. */
function subjectOf(fact: Fact): string {
  return String(fact.params.name ?? fact.params.a ?? '');
}

/**
 * `n` facts, each about a different player, in a ready-to-render order. Cycles
 * a shuffled template list so a batch spreads across templates instead of
 * landing on the same shape repeatedly. Returns fewer than `n` only if the
 * dataset is unexpectedly thin — callers render whatever they get.
 */
export function matchmakingFacts(n: number, rng: Rng = Math.random): Fact[] {
  const out: Fact[] = [];
  const seen = new Set<string>();
  let order: Template[] = [];
  for (let tries = 0; out.length < n && tries < n * 40; tries++) {
    if (order.length === 0) {
      order = shuffle(TEMPLATES, rng);
    }
    const fact = order.pop()?.(rng);
    if (!fact) {
      continue;
    }
    const subject = subjectOf(fact);
    if (seen.has(subject)) {
      continue;
    }
    seen.add(subject);
    out.push(fact);
  }
  return out;
}
