import type {GameManifest} from '../core/games/types';

/**
 * The list of games Miflo offers. For v1 there is one — the football quiz —
 * but the Home hub renders whatever is registered here, so shipping a second
 * game is an entry in this array plus its screens.
 */
export const games: GameManifest[] = [
  {
    id: 'quiz',
    title: 'Football Quiz',
    subtitle: 'Trivia with your mates, in the room',
    entryRoute: 'QuizCreate',
    available: true,
  },
  {
    id: 'odd-one-out',
    title: 'Odd One Out',
    subtitle: 'Four players, one breaks the pattern',
    entryRoute: 'OddOneOutCreate',
    available: true,
  },
  {
    id: 'missing-xi',
    title: 'Missing XI',
    subtitle: 'Name the missing player from iconic line-ups',
    entryRoute: 'MissingXiCreate',
    available: true,
  },
];
