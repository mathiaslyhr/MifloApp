/**
 * Hardcoded content for the M1 static screens. Lets every quiz screen render
 * realistic data before the live game loop (M3/M4) replaces it. Mirrors the
 * Danish design mockups, in English copy.
 */

export type Topic = {id: string; label: string};

/** Selectable topics on the Create screen. `all` is a convenience toggle. */
export const TOPICS: readonly Topic[] = [
  {id: 'all', label: 'All'},
  {id: 'premier-league', label: 'Premier League'},
  {id: 'la-liga', label: 'La Liga'},
  {id: 'serie-a', label: 'Serie A'},
  {id: 'bundesliga', label: 'Bundesliga'},
  {id: 'ligue-1', label: 'Ligue 1'},
  {id: 'champions-league', label: 'Champions League'},
  {id: 'world-cup', label: 'World Cup'},
  {id: 'legends', label: 'Legends'},
];

export const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;

/** Default Create-screen selections matching the mockup. */
export const DEFAULT_QUESTION_COUNT = 10;
export const DEFAULT_TOPIC_IDS = [
  'premier-league',
  'la-liga',
  'champions-league',
  'legends',
];

/** Fake "questions match your topics" count shown under the topic chips. */
export const MATCHING_QUESTION_COUNT = 112;

export type Player = {id: string; name: string; isHost?: boolean; isYou?: boolean};

export const PLAYERS: readonly Player[] = [
  {id: 'magnus', name: 'Magnus', isHost: true},
  {id: 'frederik', name: 'Frederik'},
  {id: 'oliver', name: 'Oliver'},
  {id: 'emil', name: 'Emil', isYou: true},
];

export type Question = {
  topic: string;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
};

export const QUESTIONS: readonly Question[] = [
  {
    topic: 'Champions League · classic',
    prompt: 'Which club won the Champions League in 2012?',
    options: ['Chelsea', 'Bayern München', 'Barcelona', 'Real Madrid'],
    correctIndex: 0,
  },
];

export type Standing = {
  rank: number;
  player: Player;
  points: number;
  movement: 'up' | 'down' | 'none';
};

/** Standings after question 3 / 10 (matches the Stilling mockup). */
export const STANDINGS: readonly Standing[] = [
  {rank: 1, player: {id: 'emil', name: 'Emil', isYou: true}, points: 2080, movement: 'up'},
  {rank: 2, player: {id: 'magnus', name: 'Magnus', isHost: true}, points: 1900, movement: 'down'},
  {rank: 3, player: {id: 'oliver', name: 'Oliver'}, points: 1620, movement: 'up'},
  {rank: 4, player: {id: 'frederik', name: 'Frederik'}, points: 1300, movement: 'down'},
];

/** Format points with a thin space thousands separator: 1240 -> "1 240". */
export function formatPoints(points: number): string {
  return points.toLocaleString('en-US').replace(/,/g, ' ');
}
