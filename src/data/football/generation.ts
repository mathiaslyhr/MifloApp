/**
 * Dataset generation counter — bumped by store.hydrate() whenever an OTA
 * content pack replaces the in-memory data. Module-level structures derived
 * from the dataset (id maps, name pools) wrap themselves in derivedFromData
 * so they rebuild lazily after a hydrate instead of going stale.
 *
 * Deliberately dependency-free: imported by data modules AND by the store,
 * so it must sit below both in the import graph.
 */

let currentGeneration = 0;

export function generation(): number {
  return currentGeneration;
}

export function bumpGeneration(): void {
  currentGeneration++;
}

/** Memoize a dataset-derived value; recomputes on first read after a hydrate. */
export function derivedFromData<T>(compute: () => T): () => T {
  let computedAt = -1;
  let value: T;
  return () => {
    if (computedAt !== currentGeneration) {
      value = compute();
      computedAt = currentGeneration;
    }
    return value;
  };
}
