/**
 * Tiny dependency-free version-string comparison (kept separate from
 * versionGate so it's unit-testable without pulling in the Supabase client).
 */

/**
 * Compare two dotted version strings numerically. Missing segments count as 0
 * ("1.2" == "1.2.0"). Returns <0 if a<b, 0 if equal, >0 if a>b.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** Is `current` at or above the required `min`? */
export function isVersionSupported(current: string, min: string): boolean {
  return compareVersions(current, min) >= 0;
}
