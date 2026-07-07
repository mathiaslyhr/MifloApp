import {
  Grid3x3,
  Hexagon,
  ListOrdered,
  UserSearch,
  VenetianMask,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * Presentation catalog for the Games hub — the user-facing display metadata
 * (title, tagline, icon) for the games we surface.
 *
 * These are the next-gen games; none are built yet, so `gameType` here is just a
 * frontend placeholder id (not yet wired to any engine room). The older games
 * (`quiz` / `missing-xi` / `odd-one-out`) still live in `src/games/` but are no
 * longer listed here.
 */
export type GameType =
  | 'tic-tac-toe'
  | 'footballer-imposter'
  | 'mystery-footballer'
  | 'tenball'
  | 'heatmap';

/**
 * Audience bucket a game is recommended for, by group size. Drives the
 * "Recommended for …" section headers on the Games hub:
 * - `solo` — best played alone.
 * - `duel` — head-to-head, two players (1v1).
 * - `party` — a group of three or more.
 */
export type GameCategory = 'solo' | 'duel' | 'party';

export type GameEntry = {
  gameType: GameType;
  /** i18n key prefix under `games.*` (title/tagline resolved at render). */
  i18nKey: string;
  Icon: LucideIcon;
  /** Which "Recommended for …" group the game is filed under on the hub. */
  category: GameCategory;
  /** Whether the game has a real engine and can actually be started. */
  available: boolean;
  /**
   * A local single-player game: it opens straight to its screen instead of
   * minting a party/room, and never appears in the Lobby's multiplayer picker.
   */
  single?: boolean;
};

export const GAMES: GameEntry[] = [
  {
    gameType: 'mystery-footballer',
    i18nKey: 'mystery',
    Icon: UserSearch,
    category: 'solo',
    available: true,
    single: true,
  },
  {
    gameType: 'tenball',
    i18nKey: 'tenball',
    Icon: ListOrdered,
    category: 'solo',
    available: false,
  },
  {
    gameType: 'tic-tac-toe',
    i18nKey: 'ttt',
    Icon: Grid3x3,
    category: 'duel',
    available: true,
  },
  {
    gameType: 'heatmap',
    i18nKey: 'heatmap',
    Icon: Hexagon,
    category: 'duel',
    available: false,
  },
  {
    gameType: 'footballer-imposter',
    i18nKey: 'imposter',
    Icon: VenetianMask,
    category: 'party',
    available: true,
  },
];

/**
 * The "Recommended for …" groups, in display order. Each entry pairs a
 * {@link GameCategory} with its i18n key under `games.categories.*`. The Games
 * hub walks this list to render a section header followed by the games whose
 * `category` matches.
 */
export const GAME_CATEGORIES: {category: GameCategory; i18nKey: string}[] = [
  {category: 'solo', i18nKey: 'solo'},
  {category: 'duel', i18nKey: 'duel'},
  {category: 'party', i18nKey: 'party'},
];

/**
 * Whether a room's stored game type is a built, startable game. Used by the
 * Lobby to decide locked mode (came from the Games tab) vs the free picker
 * (came from Home, where the room is created as `'unset'`).
 */
export function isBuiltGame(gameType: string): boolean {
  return GAMES.some(g => g.gameType === gameType && g.available);
}
