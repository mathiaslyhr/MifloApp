import {dedupeByLabel, nameEntry} from '../nameSearch';

describe('dedupeByLabel', () => {
  it('merges same-label entries, first (canonical) label wins', () => {
    const pool = dedupeByLabel([
      nameEntry('Inter Milan', [], 'Italy', 'inter'),
      nameEntry('Inter Milan', ['inter', 'internazionale']),
    ]);
    expect(pool).toHaveLength(1);
    expect(pool[0].clubId).toBe('inter');
    expect(pool[0].searchTexts).toEqual(
      expect.arrayContaining(['inter', 'internazionale']),
    );
  });

  it('merges an entry whose label is another entry\'s known name', () => {
    // The Brøndby bug: the dataset says 'Brøndby', a list says 'Brøndby IF'
    // but admits to being 'brøndby' via its aliases. One suggestion row, the
    // canonical label, matchable by every alias.
    const pool = dedupeByLabel([
      nameEntry('Brøndby', [], 'Denmark', 'brondby'),
      nameEntry('Brøndby IF', ['brondby', 'brøndby', 'bif']),
    ]);
    expect(pool).toHaveLength(1);
    expect(pool[0].label).toBe('Brøndby');
    expect(pool[0].searchTexts).toEqual(expect.arrayContaining(['bif', 'brøndby if']));
  });

  it('merges when the canonical entry comes second, keeping the first label', () => {
    const pool = dedupeByLabel([
      nameEntry('Bayern Munich', ['bayern', 'bayern munchen']),
      nameEntry('Bayern München', [], 'Germany', 'bayern'),
    ]);
    expect(pool).toHaveLength(1);
    expect(pool[0].label).toBe('Bayern Munich');
  });

  it('does NOT merge distinct entries that merely share a nickname', () => {
    // A shared short alias is not identity — two clubs can both answer to
    // 'city' without being the same club.
    const pool = dedupeByLabel([
      nameEntry('Manchester City', ['city', 'man city']),
      nameEntry('Bristol City', ['city']),
    ]);
    expect(pool.map(e => e.label)).toEqual(['Manchester City', 'Bristol City']);
  });

  it('folds a later variant into an already-merged entity', () => {
    const pool = dedupeByLabel([
      nameEntry('AS Roma', [], 'Italy', 'roma'),
      nameEntry('Roma', ['as roma']),
      nameEntry('Roma', ['giallorossi']),
    ]);
    expect(pool).toHaveLength(1);
    expect(pool[0].label).toBe('AS Roma');
    expect(pool[0].searchTexts).toEqual(expect.arrayContaining(['giallorossi']));
  });
});
