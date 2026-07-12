/**
 * Head-to-head between two friends across the online party games (Hattrick,
 * Offside, Cult Hero, Red Card). The backend `head_to_head` RPC (0031) returns
 * only the games both friends played, with each side's result; this module is
 * the pure domain shape + tally. No React, no backend — kept separate (like
 * careerStats.ts) so it's trivially unit-testable.
 *
 * "Who won" is pairwise by score: in each shared game the higher score wins,
 * equal is a draw — so you can win a matchup in a 3+ player game even if a third
 * person topped the room. Hattrick encodes 1 (won) / 0 (lost or tie), so its
 * matchups fall out of the same comparison.
 */

/** One player's line in a recorded game. */
export type HeadToHeadSide = {
  score: number;
  rank: number;
  isWinner: boolean;
};

/** One game both friends played, newest first from the RPC. */
export type HeadToHeadMatch = {
  matchId: string;
  /** Server game-type string: 'hattrick' | 'offside' | 'cult-hero' | 'red-card'. */
  gameType: string;
  /** ISO timestamp the result was recorded. */
  playedAt: string;
  totalPlayers: number;
  /** The caller's side. */
  mine: HeadToHeadSide;
  /** The friend's side. */
  theirs: HeadToHeadSide;
};

/** The pairwise outcome of a single matchup, from the caller's point of view. */
export type MatchOutcome = 'win' | 'loss' | 'draw';

/** Who won a single matchup: higher score wins, equal is a draw. */
export function outcomeOf(match: HeadToHeadMatch): MatchOutcome {
  if (match.mine.score > match.theirs.score) {
    return 'win';
  }
  if (match.mine.score < match.theirs.score) {
    return 'loss';
  }
  return 'draw';
}

/** A win/loss/draw tally, from the caller's point of view. */
export type HeadToHeadRecord = {myWins: number; theirWins: number; draws: number};

export type HeadToHeadSummary = HeadToHeadRecord & {
  /** Total games played together. */
  total: number;
  /** The same tally split by game type, for the per-game breakdown. */
  perGame: Record<string, HeadToHeadRecord>;
};

function emptyRecord(): HeadToHeadRecord {
  return {myWins: 0, theirWins: 0, draws: 0};
}

/** Roll a list of matchups into an overall tally plus a per-game-type tally. */
export function computeHeadToHead(
  matches: readonly HeadToHeadMatch[],
): HeadToHeadSummary {
  const overall = emptyRecord();
  const perGame: Record<string, HeadToHeadRecord> = {};

  for (const match of matches) {
    const bucket = perGame[match.gameType] ?? emptyRecord();
    switch (outcomeOf(match)) {
      case 'win':
        overall.myWins += 1;
        bucket.myWins += 1;
        break;
      case 'loss':
        overall.theirWins += 1;
        bucket.theirWins += 1;
        break;
      default:
        overall.draws += 1;
        bucket.draws += 1;
    }
    perGame[match.gameType] = bucket;
  }

  return {...overall, total: matches.length, perGame};
}
