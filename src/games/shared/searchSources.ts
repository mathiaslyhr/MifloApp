/**
 * Search sources — thin adapters that turn each of the app's matching engines
 * (footballer search, the name ladder, the friend filter) into one shared shape
 * the FotMob-style `SearchScreen` grid can render. The ranking/matching logic is
 * unchanged; a source only maps its engine's hits to `SearchItem`s (a label plus
 * tile art). One grid, every entity type.
 */
import type {ImageSourcePropType} from 'react-native';
import {
  CLUBS,
  FOOTBALLERS,
  derivedFromData,
  getById,
} from '../../data/football';
import {searchPlayers, fold} from '../hattrick/playerSearch';
import {searchNames, type NameEntry} from './nameSearch';
import {searchSuggestions} from '../tenball/suggestions';
import type {TenballKind} from '../tenball/types';
import {flagImage, logoImage} from '../hattrick/criterionIcon';
import {PLAYER_AVATARS} from '../hattrick/assets/playerAvatars';
import {filterFriends, shouldOfferRequest} from '../../core/social/friendSearch';
import type {DirectoryPerson, SocialProfile} from '../../core/social/types';

/** One person a people search can turn up, friend or stranger. */
export type SearchPerson = DirectoryPerson;

/** One selectable tile in the grid. */
export type SearchItem = {
  /** Stable identity returned to the caller on pick (footballer id, club slug,
   * nation string, submit text, user id, …). */
  id: string;
  label: string;
  /** Bundled crest/flag/portrait (a Metro asset id or `{uri}`). */
  image?: ImageSourcePropType;
  /** Initials + optional photo for a person tile (users). Rendered as an
   * `Avatar` when present; wins over `image`. */
  avatar?: {initials: string; uri?: string | null};
  /** Extra line shown ONLY when this item's label clashes with another visible
   * result — a position for identically-named players, a friend code for
   * same-named users. */
  subtitle?: string;
};

/**
 * Anything the grid can search: a query in, ranked tiles out.
 *
 * Sources over the bundled football dataset answer synchronously and should —
 * a local filter has no reason to make you wait. People search has to ask the
 * server, so `search` may also return a promise; `debounceMs` is how a source
 * says "I cost a round trip, don't call me on every keystroke".
 */
export type SearchSource = {
  search(query: string): SearchItem[] | Promise<SearchItem[]>;
  /** Wait this long after the last keystroke before searching. Default 0 —
   * instant, which is what every local source wants. */
  debounceMs?: number;
};

/** Portrait for a footballer id, falling back to their nationality flag (the
 * same rule the profile favorites use). */
function playerImage(id: string): ImageSourcePropType | undefined {
  const portrait = PLAYER_AVATARS[id];
  if (portrait != null) {
    return portrait;
  }
  return flagImage(getById(id)?.nationality[0]) ?? undefined;
}

/** Footballer search over the whole dataset (Hattrick, Red Card, dailies, …). */
export function playerSource(
  excludedIds: readonly string[] = [],
): SearchSource {
  return {
    search: query =>
      searchPlayers(FOOTBALLERS, query, excludedIds).map(f => ({
        id: f.id,
        label: f.name,
        image: playerImage(f.id),
        subtitle: f.positions[0],
      })),
  };
}

// Club/nation pools carry the stable id in `submitText` so a pick can return it
// (the label-only NameEntry search stays generic). Memoized against OTA
// hydration, which mutates CLUBS/FOOTBALLERS in place.
const clubEntries = derivedFromData<NameEntry[]>(() =>
  CLUBS.map(c => ({label: c.name, submitText: c.id, searchTexts: [fold(c.name)]})),
);

const nationEntries = derivedFromData<NameEntry[]>(() =>
  [...new Set(FOOTBALLERS.flatMap(f => f.nationality))]
    .filter(n => flagImage(n) != null)
    .sort()
    .map(n => ({label: n, submitText: n, searchTexts: [fold(n)]})),
);

/** Club search (crest tiles); pick returns the club slug. */
export function clubSource(limit = 30): SearchSource {
  return {
    search: query =>
      searchNames(clubEntries(), query, limit).map(e => ({
        id: e.submitText,
        label: e.label,
        image: logoImage(e.submitText) ?? undefined,
      })),
  };
}

/** Nation search over nationalities with a bundled flag; pick returns the
 * nation string. */
export function nationSource(limit = 30): SearchSource {
  return {
    search: query =>
      searchNames(nationEntries(), query, limit).map(e => ({
        id: e.submitText,
        label: e.label,
        image: flagImage(e.submitText) ?? undefined,
      })),
  };
}

/** Top Bins' non-player pools (club/nation/manager/other historic names); pick
 * returns the submit text. Art is the country flag when the entry carries one,
 * mirroring the old inline type-ahead. */
export function suggestionSource(
  kind: Exclude<TenballKind, 'player'>,
  limit = 30,
): SearchSource {
  return {
    search: query =>
      searchSuggestions(kind, query, limit).map(e => ({
        id: e.submitText,
        label: e.label,
        image: e.flagCountry ? flagImage(e.flagCountry) ?? undefined : undefined,
      })),
  };
}

/** The id prefix that marks the grid's "add this friend code" tile, so the
 * caller can tell an add-by-code pick from a real friend pick. */
export const ADD_FRIEND_PREFIX = 'add-friend:';

/**
 * People search over a friend list: name substring or exact code filters the
 * friends, and a query spelling an unknown friend code appends an "add" tile
 * (adding a friend IS searching for them). The caller maps its own row type to
 * a `SearchItem` (avatar) and supplies the add tile's label.
 */
export function friendSource<T extends {profile: SocialProfile}>(
  items: readonly T[],
  toItem: (item: T) => SearchItem,
  addLabel: (code: string) => string,
): SearchSource {
  const pool = [...items];
  return {
    search: query => {
      const results = filterFriends(pool, query).map(toItem);
      const code = shouldOfferRequest(pool, query);
      if (code) {
        results.push({
          id: ADD_FRIEND_PREFIX + code,
          label: addLabel(code),
          avatar: {initials: '+'},
        });
      }
      return results;
    },
  };
}

/** How long to sit on a keystroke before asking the server who that is. */
const PEOPLE_DEBOUNCE_MS = 220;

/**
 * People search across EVERYONE, not just your friends: your own list answers
 * from memory the instant you type, and the server (search_profiles, 0043)
 * fills in everyone else a moment later. A query that spells a friend code
 * still offers the add tile, so both ways of naming a person work.
 *
 * Your friends sort first — the list you're filtering is mostly the list you
 * meant — and a friend found remotely is folded into their local row rather
 * than appearing twice.
 */
export function peopleSource(
  friends: readonly SocialProfile[],
  searchRemote: (query: string) => Promise<SearchPerson[]>,
  toItem: (person: SearchPerson) => SearchItem,
  addLabel: (code: string) => string,
): SearchSource {
  const pool = friends.map(profile => ({profile}));
  return {
    debounceMs: PEOPLE_DEBOUNCE_MS,
    search: async query => {
      const mine: SearchPerson[] = filterFriends(pool, query).map(f => ({
        userId: f.profile.userId,
        displayName: f.profile.displayName,
        avatarPath: f.profile.avatarPath,
        isFriend: true,
      }));
      const seen = new Set(mine.map(p => p.userId));

      let theirs: SearchPerson[] = [];
      try {
        theirs = (await searchRemote(query)).filter(p => !seen.has(p.userId));
      } catch {
        // Offline, or the RPC isn't deployed yet: your own friends still
        // filter, which is exactly what this field did before it could do more.
      }

      const results = [...mine, ...theirs].map(toItem);
      const code = shouldOfferRequest(pool, query);
      if (code) {
        results.push({
          id: ADD_FRIEND_PREFIX + code,
          label: addLabel(code),
          avatar: {initials: '+'},
        });
      }
      return results;
    },
  };
}
