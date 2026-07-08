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
  | 'hattrick'
  | 'red-card'
  | 'scout'
  | 'tenball'
  | 'heatmap';

/**
 * Audience bucket a game is recommended for, by group size. Surfaced as a small
 * chip on each tile in the Games hub (label resolved via `games.audience.*`):
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
  /** Audience bucket, shown as a chip on the hub tile (via `games.audience.*`). */
  category: GameCategory;
  /** Whether the game has a real engine and can actually be started. */
  available: boolean;
  /**
   * A local single-player game: it opens straight to its screen instead of
   * minting a party/room, and never appears in the Lobby's multiplayer picker.
   */
  single?: boolean;
};

/**
 * Games in hub display order: playable games first, then "coming soon" ones.
 * The hub renders this list flat (no grouping); each tile shows an audience chip
 * from its `category`, and unavailable games render dimmed at the bottom.
 */
export const GAMES: GameEntry[] = [
  {
    gameType: 'scout',
    i18nKey: 'scout',
    Icon: UserSearch,
    category: 'solo',
    available: true,
    single: true,
  },
  {
    gameType: 'hattrick',
    i18nKey: 'hattrick',
    Icon: Grid3x3,
    category: 'duel',
    available: true,
  },
  {
    gameType: 'red-card',
    i18nKey: 'redCard',
    Icon: VenetianMask,
    category: 'party',
    available: true,
  },
  {
    gameType: 'tenball',
    i18nKey: 'tenball',
    Icon: ListOrdered,
    category: 'solo',
    available: false,
  },
  {
    gameType: 'heatmap',
    i18nKey: 'heatmap',
    Icon: Hexagon,
    category: 'duel',
    available: false,
  },
];

/**
 * Whether a room's stored game type is a built, startable game. Used by the
 * Lobby to decide locked mode (came from the Games tab) vs the free picker
 * (came from Home, where the room is created as `'unset'`).
 */
export function isBuiltGame(gameType: string): boolean {
  return GAMES.some(g => g.gameType === gameType && g.available);
}
