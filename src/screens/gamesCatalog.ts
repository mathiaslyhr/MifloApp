import {createElement} from 'react';
import {
  ClipboardList,
  Flag,
  Gem,
  Grid3x3,
  Hexagon,
  ListOrdered,
  RectangleVertical,
  Route,
  Ticket,
  UserSearch,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react-native';

/** A referee's card is a solid block, not an outline — fill it with the same
 * colour the tile passes as the stroke. */
const CardIcon = ((props: LucideProps) =>
  createElement(RectangleVertical, {
    ...props,
    fill: (props.color as string) ?? 'currentColor',
  })) as LucideIcon;

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
  | 'heatmap'
  | 'matchday'
  | 'journeyman'
  | 'teamsheet'
  | 'offside'
  | 'cult-hero';

/**
 * Audience bucket a game is recommended for, by group size. Surfaced as a small
 * chip on each tile in the Games hub (label resolved via `games.audience.*`):
 * - `solo` — best played alone.
 * - `duel` — head-to-head, two players (1v1).
 * - `group` — two or more; works head-to-head AND as a party.
 * - `party` — a group of three or more.
 */
export type GameCategory = 'solo' | 'duel' | 'group' | 'party';

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
  /**
   * Also playable pass-and-play on one shared phone (no room, no network).
   * Tapping the tile opens a mode chooser: "On this phone" vs online.
   */
  localPlay?: boolean;
  /**
   * A once-a-day puzzle (same for everyone, streaks). The hub tile shows a
   * "Daily" pill next to the audience pill.
   */
  daily?: boolean;
  /** Multiplayer player range, for the Play-tab card badge (omitted for solo). */
  minPlayers?: number;
  maxPlayers?: number;
};

/**
 * Per-game identity colours for the Play-tab colored-square icon badges. These
 * are fixed brand tones (like the guess-feedback colours), not theme tokens, so
 * a game reads the same in both appearances. Tweak freely.
 */
export const GAME_COLORS: Record<GameType, string> = {
  hattrick: '#6260FF',
  'red-card': '#FF6A61',
  offside: '#5B9CFF',
  'cult-hero': '#C77DFF',
  scout: '#4FB477',
  tenball: '#E0A94A',
  journeyman: '#5BC8C0',
  teamsheet: '#E06C9F',
  heatmap: '#8B93A7',
  matchday: '#8B93A7',
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
    daily: true,
  },
  {
    gameType: 'tenball',
    i18nKey: 'tenball',
    Icon: ListOrdered,
    category: 'solo',
    available: true,
    single: true,
    daily: true,
  },
  {
    gameType: 'journeyman',
    i18nKey: 'journeyman',
    Icon: Route,
    category: 'solo',
    available: true,
    single: true,
    daily: true,
  },
  {
    gameType: 'teamsheet',
    i18nKey: 'teamsheet',
    Icon: ClipboardList,
    category: 'solo',
    available: true,
    single: true,
    daily: true,
  },
  {
    gameType: 'hattrick',
    i18nKey: 'hattrick',
    Icon: Grid3x3,
    category: 'duel',
    available: true,
    localPlay: true,
    minPlayers: 2,
    maxPlayers: 2,
  },
  {
    gameType: 'offside',
    i18nKey: 'offside',
    Icon: Flag,
    category: 'group',
    available: true,
    localPlay: true,
    minPlayers: 2,
    maxPlayers: 8,
  },
  {
    gameType: 'cult-hero',
    i18nKey: 'cultHero',
    Icon: Gem,
    category: 'group',
    available: true,
    localPlay: true,
    minPlayers: 2,
    maxPlayers: 8,
  },
  {
    gameType: 'red-card',
    i18nKey: 'redCard',
    Icon: CardIcon,
    category: 'party',
    available: true,
    localPlay: true,
    minPlayers: 3,
    maxPlayers: 8,
  },
  {
    gameType: 'heatmap',
    i18nKey: 'heatmap',
    Icon: Hexagon,
    category: 'duel',
    available: false,
  },
  {
    gameType: 'matchday',
    i18nKey: 'matchday',
    Icon: Ticket,
    category: 'party',
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
