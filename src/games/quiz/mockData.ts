/**
 * Static quiz config + shared domain types. Questions are now generated from
 * the football fact layer (see questions.ts) and scores come from the game
 * store; this file only holds setup constants and small shared types/helpers.
 * Copy is English even though the design mockups are in Danish.
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
  {id: 'ballon-dor', label: "Ballon d'Or"},
  {id: 'current-stars', label: 'Current Stars'},
  {id: 'legends', label: 'Legends'},
];

export const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;

/** Default Create-screen selections matching the mockup. */
export const DEFAULT_QUESTION_COUNT = 10;
export const DEFAULT_TOPIC_IDS = [
  'current-stars',
  'premier-league',
  'champions-league',
  'legends',
];

/** A person in a room (lobby/standings), not a footballer. */
export type Player = {id: string; name: string; isHost?: boolean; isYou?: boolean};

export type Question = {
  topic: string;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
  /** Footballer this question is about (set for generated questions). Lets a
   *  next round exclude already-used players, and Reveal show who it was. */
  footballerId?: string;
};

/** Format points with a thin space thousands separator: 1240 -> "1 240". */
export function formatPoints(points: number): string {
  return points.toLocaleString('en-US').replace(/,/g, ' ');
}
