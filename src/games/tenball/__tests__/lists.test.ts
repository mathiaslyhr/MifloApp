/**
 * Content validation for the curated Top Bins lists. Runs in the data:publish
 * gate too — a malformed list must never reach the OTA pack.
 */
import en from '../../../core/i18n/en.json';
import da from '../../../core/i18n/da.json';
import {getById} from '../../../data/football';
import {fold} from '../../hattrick/playerSearch';
import {FLAG_IMAGES} from '../../hattrick/assets/flags.generated';
import {BUNDLED_LISTS, getListById, LIST_POOL} from '../lists';

describe('bundled Top Bins lists', () => {
  it('has at least one list and unique list ids', () => {
    expect(BUNDLED_LISTS.length).toBeGreaterThan(0);
    const ids = BUNDLED_LISTS.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(BUNDLED_LISTS.map(l => [l.id, l] as const))(
    '%s is a valid top-10 list',
    (_id, list) => {
      expect(list.entries).toHaveLength(10);

      const ranks = [...list.entries].map(e => e.rank).sort((a, b) => a - b);
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      const seen = new Set<string>();
      for (const entry of list.entries) {
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.value.trim().length).toBeGreaterThan(0);
        expect(entry.aliases.length).toBeGreaterThan(0);
        for (const alias of entry.aliases) {
          // Aliases are stored pre-folded so guess matching is a plain lookup.
          expect(alias).toBe(fold(alias));
          // Unique across the whole list — every answer owns exactly one
          // slot, so "Last 10" lists must dedupe repeat winners.
          expect({list: list.id, alias, duplicate: seen.has(alias)}).toEqual({
            list: list.id,
            alias,
            duplicate: false,
          });
          seen.add(alias);
        }
        if (entry.footballerId !== undefined) {
          expect(getById(entry.footballerId)).toBeDefined();
        }
      }
    },
  );

  it('every bundled list declares what kind of answers it holds', () => {
    // The runtime type keeps `kind` optional (old OTA packs lack it and fall
    // back to 'player'), but new content must always say what the type-ahead
    // should search.
    for (const list of BUNDLED_LISTS) {
      expect({list: list.id, kind: list.kind}).toEqual({
        list: list.id,
        kind: expect.stringMatching(/^(player|club|nation|manager|other)$/),
      });
    }
  });

  it('every list has a title in both language catalogs', () => {
    for (const list of BUNDLED_LISTS) {
      const enTitle = (en.tenball.lists as Record<string, {title: string}>)[list.id]?.title;
      const daTitle = (da.tenball.lists as Record<string, {title: string}>)[list.id]?.title;
      expect(enTitle).toBeTruthy();
      expect(daTitle).toBeTruthy();
    }
  });

  it('every list states what it counts up to, in both catalogs', () => {
    // A list that doesn't say where its data stops turns a right-feeling answer
    // into a miss (the 2026 World Cup did exactly that on wc-top-scorers).
    for (const list of BUNDLED_LISTS) {
      const notes = (id: string, cat: typeof en) =>
        (cat.tenball.lists as Record<string, {note?: string}>)[id]?.note;
      expect(notes(list.id, en)).toBeTruthy();
      expect(notes(list.id, da)).toBeTruthy();
    }
  });

  it('keeps copy free of dashes as punctuation', () => {
    for (const list of BUNDLED_LISTS) {
      for (const cat of [en, da]) {
        const {title, note} = (cat.tenball.lists as Record<
          string,
          {title: string; note?: string}
        >)[list.id];
        for (const s of [title, note ?? '']) {
          expect(s).not.toContain('—');
          expect(s).not.toContain(' - ');
        }
      }
    }
  });

  it('getListById resolves pool entries and misses unknown ids', () => {
    expect(getListById(LIST_POOL[0].id)).toBe(LIST_POOL[0]);
    expect(getListById('nope')).toBeUndefined();
  });

  it('every entry flagCountry has a bundled flag', () => {
    // The type-ahead renders flagImage(flagCountry); a typo ('Holland',
    // 'UK') would silently drop the flag rather than fail, so pin it here.
    const bad: string[] = [];
    for (const list of BUNDLED_LISTS) {
      for (const entry of list.entries) {
        if (entry.flagCountry && !FLAG_IMAGES[entry.flagCountry]) {
          bad.push(`${list.id}: ${entry.name} → ${entry.flagCountry}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every entry on an `other` (place) list carries a flag', () => {
    // Cities have no crest and no squad, so the flag is the only art the
    // type-ahead can show them with. This is the rule, not a property of
    // today's ten: a new city list, or one more city on an existing one,
    // fails here until it names its country. See TenballKind in types.ts.
    const missing: string[] = [];
    for (const list of BUNDLED_LISTS) {
      if ((list.kind ?? 'player') !== 'other') {
        continue;
      }
      for (const entry of list.entries) {
        if (!entry.flagCountry) {
          missing.push(`${list.id}: ${entry.name}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
