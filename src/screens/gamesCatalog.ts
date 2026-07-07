import {Grid3x3, Hexagon, ListOrdered, type LucideIcon} from 'lucide-react-native';

/**
 * Presentation catalog for the Games hub — the user-facing display metadata
 * (title, tagline, icon) for the games we surface.
 *
 * These are the next-gen games; none are built yet, so `gameType` here is just a
 * frontend placeholder id (not yet wired to any engine room). The older games
 * (`quiz` / `missing-xi` / `odd-one-out`) still live in `src/games/` but are no
 * longer listed here.
 */
export type GameType = 'tic-tac-toe' | 'tenball' | 'heatmap';

export type GameEntry = {
  gameType: GameType;
  /** i18n key prefix under `games.*` (title/tagline resolved at render). */
  i18nKey: string;
  Icon: LucideIcon;
  /** Whether the game has a real engine and can actually be started. */
  available: boolean;
};

export const GAMES: GameEntry[] = [
  {gameType: 'tic-tac-toe', i18nKey: 'ttt', Icon: Grid3x3, available: true},
  {gameType: 'tenball', i18nKey: 'tenball', Icon: ListOrdered, available: false},
  {gameType: 'heatmap', i18nKey: 'heatmap', Icon: Hexagon, available: false},
];

/**
 * Whether a room's stored game type is a built, startable game. Used by the
 * Lobby to decide locked mode (came from the Games tab) vs the free picker
 * (came from Home, where the room is created as `'unset'`).
 */
export function isBuiltGame(gameType: string): boolean {
  return GAMES.some(g => g.gameType === gameType && g.available);
}
