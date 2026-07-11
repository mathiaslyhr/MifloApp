import {
  buildPromptKeys,
  notePrompts,
  parsePromptKey,
  promptCandidates,
  promptText,
  takeSessionPrompts,
} from '../prompts';
import {buildPromptPayloads} from '../famePrior';
import {MAX_ROUNDS, MIN_ELIGIBLE} from '../types';
import {find} from '../../../data/football';

/** Deterministic rng for shuffle-based helpers. */
function seededRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const kindOf = (key: string) => key.split(':')[0];

describe('promptCandidates', () => {
  const candidates = promptCandidates();

  it('yields a healthy pool with every kind represented', () => {
    expect(candidates.length).toBeGreaterThan(30);
    const kinds = new Set(candidates.map(c => kindOf(c.key)));
    expect(kinds).toEqual(new Set(['club', 'nat', 'league', 'honour']));
  });

  it('meets the quality gate: every candidate has enough eligible players', () => {
    for (const c of candidates) {
      expect(find([c.criterion]).length).toBeGreaterThanOrEqual(MIN_ELIGIBLE);
    }
  });

  it('round-trips every key through parsePromptKey', () => {
    for (const c of candidates) {
      expect(parsePromptKey(c.key)).toEqual(c.criterion);
    }
  });
});

describe('parsePromptKey', () => {
  it('rejects malformed or unknown keys', () => {
    expect(parsePromptKey('')).toBeNull();
    expect(parsePromptKey('club:')).toBeNull();
    expect(parsePromptKey('position:GK')).toBeNull();
    expect(parsePromptKey('honour:not-a-real-honour')).toBeNull();
    expect(parsePromptKey('no-colon')).toBeNull();
  });
});

describe('buildPromptKeys', () => {
  it('returns the asked number of distinct keys', () => {
    const keys = buildPromptKeys(5, seededRng());
    expect(keys).toHaveLength(5);
    expect(new Set(keys).size).toBe(5);
  });

  it('caps prompts of the same kind at two per game', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const keys = buildPromptKeys(5, seededRng(seed));
      const perKind: Record<string, number> = {};
      for (const key of keys) {
        perKind[kindOf(key)] = (perKind[kindOf(key)] ?? 0) + 1;
      }
      for (const count of Object.values(perKind)) {
        expect(count).toBeLessThanOrEqual(2);
      }
    }
  });

  // MAX_ROUNDS relies on every kind clearing the gate with at least two
  // candidates (MAX_PER_KIND × 4 kinds = 8); a dataset shrink would surface
  // here before a host ever sees a short game.
  it('always fills a maximum-length game, even with a fully used history', () => {
    const everyKey = promptCandidates().map(c => c.key);
    for (const used of [[], everyKey]) {
      const keys = buildPromptKeys(MAX_ROUNDS, seededRng(9), used);
      expect(keys).toHaveLength(MAX_ROUNDS);
      expect(new Set(keys).size).toBe(MAX_ROUNDS);
    }
  });

  it('prefers prompts that have not been used yet', () => {
    const all = promptCandidates().map(c => c.key);
    const fresh = all.filter(k => kindOf(k) !== 'club').slice(0, 2);
    const freshClub = all.filter(k => kindOf(k) === 'club').slice(0, 1);
    const used = all.filter(k => !fresh.includes(k) && !freshClub.includes(k));
    const keys = buildPromptKeys(3, seededRng(), used);
    expect(new Set(keys)).toEqual(new Set([...fresh, ...freshClub]));
  });
});

describe('session memory', () => {
  it('avoids repeating prompts across games of one party', () => {
    const key = `room-${Date.now()}`;
    const first = takeSessionPrompts(key, 5, seededRng(1));
    const second = takeSessionPrompts(key, 5, seededRng(2));
    for (const k of second) {
      expect(first).not.toContain(k);
    }
  });

  it('folds externally dealt prompts into the history', () => {
    const key = `room-note-${Date.now()}`;
    const dealt = buildPromptKeys(5, seededRng(3));
    notePrompts(key, dealt);
    const next = takeSessionPrompts(key, 5, seededRng(4));
    for (const k of next) {
      expect(dealt).not.toContain(k);
    }
  });
});

describe('buildPromptPayloads', () => {
  it('ships one eligible set with positive priors per key', () => {
    const keys = buildPromptKeys(4, seededRng(7));
    const payloads = buildPromptPayloads(keys);
    expect(payloads.map(p => p.key)).toEqual(keys);
    for (const p of payloads) {
      expect(p.eligible.length).toBeGreaterThanOrEqual(MIN_ELIGIBLE);
      for (const e of p.eligible) {
        expect(e.w).toBeGreaterThan(0);
      }
    }
  });
});

describe('promptText', () => {
  // A recording stub: promptText must resolve every candidate to a cultHero.*
  // i18n key with a filled interpolation value (no raw ids leaking).
  const t = (key: string, params?: Record<string, string>) =>
    `${key}|${params ? Object.values(params).join(',') : ''}`;

  it('localizes every candidate through the cultHero.prompt.* keys', () => {
    for (const c of promptCandidates()) {
      const text = promptText(c.key, t as never, 'en');
      expect(text).toMatch(/^cultHero\.prompt\./);
      if (!text.startsWith('cultHero.prompt.honour.')) {
        const value = text.split('|')[1];
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('uses Danish country names for nationality prompts', () => {
    const text = promptText('nat:Brazil', t as never, 'da');
    expect(text).toBe('cultHero.prompt.nat|Brasilien');
    const english = promptText('nat:Brazil', t as never, 'en');
    expect(english).toBe('cultHero.prompt.nat|Brazil');
  });

  it('spells out club and league names', () => {
    expect(promptText('club:real-madrid', t as never, 'en')).toBe(
      'cultHero.prompt.club|Real Madrid',
    );
    expect(promptText('league:premier-league', t as never, 'en')).toBe(
      'cultHero.prompt.league|Premier League',
    );
  });

  it('has strings for every prompt template in both languages', () => {
    const en = require('../../../core/i18n/en.json');
    const da = require('../../../core/i18n/da.json');
    for (const bundle of [en, da]) {
      expect(bundle.cultHero.prompt.club).toContain('{{club}}');
      expect(bundle.cultHero.prompt.nat).toContain('{{country}}');
      expect(bundle.cultHero.prompt.league).toContain('{{league}}');
    }
    const honourKinds = new Set(
      promptCandidates()
        .filter(c => c.criterion.kind === 'honour')
        .map(c => c.key.split(':')[1]),
    );
    for (const honour of honourKinds) {
      expect(typeof en.cultHero.prompt.honour[honour]).toBe('string');
      expect(typeof da.cultHero.prompt.honour[honour]).toBe('string');
    }
  });
});
