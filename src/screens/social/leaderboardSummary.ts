/**
 * The one-line "how they did" summary for a worldwide leaderboard row, as an
 * i18n key + params (so the component just calls t()). Pure and family-aware,
 * mirroring the score meaning fixed in core/social/normalize.ts:
 *   * scout/journeyman (guess one player): `score` is the non-winning guesses,
 *     so a win took `score + 1` guesses; a give-up shows "gave up".
 *   * tenball/teamsheet (fill the board): `total` slots found out of the board
 *     size, `score` misses.
 */
import type {DailyGame} from '../../core/daily/dailyLog';

const GUESS_GAMES = new Set<DailyGame>(['scout', 'journeyman']);

/** Board size per fill-the-board game, for the "X/Y found" wording. */
const SLOTS: Record<'tenball' | 'teamsheet', number> = {tenball: 10, teamsheet: 11};

export type LeaderboardSummary = {key: string; params?: Record<string, number>};

export function leaderboardSummary(
  game: DailyGame,
  status: 'won' | 'revealed',
  score: number,
  total: number,
): LeaderboardSummary {
  if (GUESS_GAMES.has(game)) {
    return status === 'won'
      ? {key: 'leaderboard.solvedGuesses', params: {count: score + 1}}
      : {key: 'leaderboard.gaveUp'};
  }
  const of = SLOTS[game as 'tenball' | 'teamsheet'] ?? total;
  return {key: 'leaderboard.foundMisses', params: {found: total, of, count: score}};
}
