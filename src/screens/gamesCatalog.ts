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
};

export const GAMES: GameEntry[] = [
  {gameType: 'tic-tac-toe', i18nKey: 'ttt', Icon: Grid3x3},
  {gameType: 'tenball', i18nKey: 'tenball', Icon: ListOrdered},
  {gameType: 'heatmap', i18nKey: 'heatmap', Icon: Hexagon},
];
