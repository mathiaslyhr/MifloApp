/**
 * Personal stats types — the shape screens see for a device's own game history,
 * mirroring the Supabase `game_results` row but transport-agnostic (same idea as
 * src/core/rooms/types.ts and src/data/football).
 */

/** One finished game, from the local player's point of view. */
export type GameResult = {
  id: string;
  roomCode: string | null;
  /** Which game this result came from — 'quiz' today; '1v1' etc. later. */
  gameType: string;
  name: string;
  score: number;
  rank: number;
  isWinner: boolean;
  totalPlayers: number;
  topicIds: string[];
  questionCount: number | null;
  playedAt: string;
};

/** Aggregated career stats across all of this device's games. */
export type CareerStats = {
  gamesPlayed: number;
  wins: number;
  /** Fraction in [0, 1]; 0 when no games played. */
  winRate: number;
  totalPoints: number;
  bestScore: number;
};

/** What the host sends to finish_game — one entry per player. */
export type ResultEntry = {
  user_id: string;
  name: string;
  score: number;
  rank: number;
  is_winner: boolean;
};
