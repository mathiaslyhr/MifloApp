import {compareVersions, isVersionSupported} from '../semver';

describe('compareVersions', () => {
  it('orders versions numerically, not lexically', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('treats missing segments as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.1', '1.2')).toBeGreaterThan(0);
  });
});

describe('isVersionSupported', () => {
  it('accepts equal or newer builds and rejects older ones', () => {
    expect(isVersionSupported('1.0.0', '1.0.0')).toBe(true);
    expect(isVersionSupported('1.2.0', '1.0.0')).toBe(true);
    expect(isVersionSupported('0.9.0', '1.0.0')).toBe(false);
  });
});
