/**
 * @format
 */
import {isCorrectGuess, normalize, suggestNames} from '../matching';
import type {LineupPlayer} from '../../../data/football';

const ozil: LineupPlayer = {name: 'Mesut Özil', position: 'FW', aliases: ['Ozil']};
const iniesta: LineupPlayer = {name: 'Andrés Iniesta', position: 'MF'};
const etoo: LineupPlayer = {name: "Samuel Eto'o", position: 'FW', aliases: ['Etoo']};

describe('normalize', () => {
  it('strips accents, casing and punctuation', () => {
    expect(normalize('Mesut Özil')).toBe('mesut ozil');
    expect(normalize("Samuel Eto'o")).toBe('samuel eto o');
    expect(normalize('  Andrés   INIESTA ')).toBe('andres iniesta');
  });
});

describe('isCorrectGuess', () => {
  it('accepts the full name regardless of accents/case', () => {
    expect(isCorrectGuess('mesut ozil', ozil)).toBe(true);
    expect(isCorrectGuess('Mesut Özil', ozil)).toBe(true);
  });

  it('accepts the surname alone', () => {
    expect(isCorrectGuess('Iniesta', iniesta)).toBe(true);
    expect(isCorrectGuess('özil', ozil)).toBe(true);
  });

  it('accepts an explicit alias', () => {
    expect(isCorrectGuess('Etoo', etoo)).toBe(true);
  });

  it('rejects a wrong or empty guess', () => {
    expect(isCorrectGuess('Xavi', iniesta)).toBe(false);
    expect(isCorrectGuess('', iniesta)).toBe(false);
    expect(isCorrectGuess('   ', iniesta)).toBe(false);
  });
});

describe('suggestNames', () => {
  it('returns nothing for an empty query', () => {
    expect(suggestNames('')).toEqual([]);
  });

  it('suggests known players by prefix, accent-insensitively', () => {
    const out = suggestNames('ozil');
    expect(out).toContain('Mesut Özil');
  });

  it('caps the number of suggestions', () => {
    expect(suggestNames('a', 4).length).toBeLessThanOrEqual(4);
  });
});
