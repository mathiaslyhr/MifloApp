import en from '../en.json';
import da from '../da.json';

/** Flatten nested translation objects to dotted leaf keys. */
function keys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') {
    return [prefix];
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('i18n catalogs', () => {
  it('English and Danish define exactly the same keys', () => {
    const enKeys = keys(en).sort();
    const daKeys = keys(da).sort();
    const missingInDa = enKeys.filter(k => !daKeys.includes(k));
    const missingInEn = daKeys.filter(k => !enKeys.includes(k));
    expect(missingInDa).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('has no empty translation values', () => {
    const allValues = (obj: unknown): string[] =>
      obj === null || typeof obj !== 'object'
        ? [String(obj)]
        : Object.values(obj as Record<string, unknown>).flatMap(allValues);
    expect(allValues(en).every(v => v.trim().length > 0)).toBe(true);
    expect(allValues(da).every(v => v.trim().length > 0)).toBe(true);
  });
});
