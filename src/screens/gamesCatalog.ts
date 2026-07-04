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
  title: string;
  tagline: string;
  Icon: LucideIcon;
};

export const GAMES: GameEntry[] = [
  {
    gameType: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    tagline: 'Football trivia × tic tac toe',
    Icon: Grid3x3,
  },
  {
    gameType: 'tenball',
    title: 'Tenball',
    tagline: 'Find the top 10 answers',
    Icon: ListOrdered,
  },
  {
    gameType: 'heatmap',
    title: 'Heatmap',
    tagline: 'Build heat across the grid',
    Icon: Hexagon,
  },
];
