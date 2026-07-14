/**
 * Ranked Hattrick types — a competitive, TURN-BASED variant. Players alternate
 * moves (like friendly Hattrick) but on a per-player chess clock: your clock
 * ticks only during your turn, and running out loses the match. This whole
 * object is the authoritative `rooms.game_state`.
 */
import type {Criterion} from '../../data/football';

export type RankedPlayer = {
  userId: string;
  name: string;
  /** Cell/label colour (hex). */
  color: string;
};

/** A permanently-claimed cell, or null if empty. */
export type RankedCell = {userId: string; footballerId: string} | null;

/** A player's match clock. Ticks down only during that player's turn. */
export type PlayerClock = {remainingMs: number; out: boolean};

/** Commentary vocabulary (rendered as toasts, except the end shown in-panel). */
export type RankedBeatKind =
  | 'goal'
  | 'level'
  | 'winner'
  | 'draw'
  | 'missed'
  | 'outOfTime';

export type RankedBeat = {
  kind: RankedBeatKind;
  /** The player the beat is about (name/colour lookups); absent for neutral. */
  userId?: string;
  /** Clients replay a beat only when seq changes. */
  seq: number;
};

export type RankedState = {
  gameType: 'ranked-hattrick';
  /** 3 row + 3 col criteria for the CURRENT board; a cell = row ∩ col. */
  rows: Criterion[];
  cols: Criterion[];
  /** 9 cells, row-major (index = row*3 + col). */
  board: RankedCell[];
  /** The two players. */
  players: RankedPlayer[];
  /** Whose turn it is (userId). */
  turnUserId: string;
  /** Server epoch ms when the current turn began — the clock burns from here. */
  turnStartedAt: number;
  /** The randomly-chosen board-1 starter; later boards alternate from it. */
  firstStarter: string;
  /** Per-player match clock, keyed by userId. */
  clocks: Record<string, PlayerClock>;
  /** Footballers used this match — can't be reused. */
  usedFootballerIds: string[];
  /** 1-based board number within the match. */
  boardNumber: number;
  /** The current board's result: winner userId, 'dead' (no line), or null. */
  boardWinner: string | 'dead' | null;
  /** Goals per userId across the match. */
  scores: Record<string, number>;
  /** The decided match: leading userId, 'draw', or null while boards remain. */
  matchWinner: string | 'draw' | null;
  /** Why the match ended — drives the reason line on the finish panel. */
  endReason?: 'boards' | 'timeout' | 'surrender' | 'left';
  /** Latest synced commentary moment (de-duped on seq). */
  beat: RankedBeat | null;
  /** Fingerprint of the current board's axes (repeat-avoidance). */
  signature: string;
  /** Anti-cheat: times each player has backgrounded the app this match. */
  blurs?: Record<string, number>;
  /** Last heartbeat per player (server epoch ms) — silence = abandonment. */
  seen?: Record<string, number>;
};
