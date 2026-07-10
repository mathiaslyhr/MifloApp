/**
 * Team sheet game logic — pure state transitions over `TeamsheetState`, plus
 * the streak tally. No React, no persistence; the screen holds the state and
 * calls these to compute the next one.
 *
 * Guess matching runs against the day's lineup only (names + aliases from
 * famousLineups.ts), never the footballer dataset — many lineup players
 * (Schmeichel, Pelé…) exist nowhere else, and an autocomplete over the XI
 * would leak the answers.
 */
import type {FamousLineup} from '../../data/football';
import {fold} from '../hattrick/playerSearch';
import {previousDateKey} from '../scout/dailySeed';
import type {
  GameStatus,
  GuessOutcome,
  HistoryEntry,
  HistoryLog,
  StreakState,
  TeamsheetGuess,
  TeamsheetState,
} from './types';

/** Complete the sheet with this many misses or fewer to keep the streak. */
export const STREAK_MISS_LIMIT = 5;

/** A fresh sheet for the given day and lineup. */
export function createInitialState(dateKey: string, lineupId: string): TeamsheetState {
  return {dateKey, lineupId, guesses: [], status: 'playing'};
}

export function isFinished(state: TeamsheetState): boolean {
  return state.status !== 'playing';
}

/** The slots (players array indices) the player has revealed so far. */
export function foundSlots(state: TeamsheetState): Set<number> {
  const slots = new Set<number>();
  for (const guess of state.guesses) {
    if (guess.slot !== undefined) {
      slots.add(guess.slot);
    }
  }
  return slots;
}

/** Wrong guesses so far — the score, lower is better. */
export function missCount(state: TeamsheetState): number {
  return state.guesses.reduce((n, g) => n + (g.slot === undefined ? 1 : 0), 0);
}

/**
 * Every folded token that names a player in this XI, mapped to their slot:
 * the full name and the curated aliases always, the bare surname (last name
 * token) only when it is unique within the XI. The lineups test enforces that
 * no token can claim two slots, so a correct guess always lands in exactly
 * one place.
 */
export function acceptedTokens(lineup: FamousLineup): Map<string, number> {
  const tokens = new Map<string, number>();
  const surnames = lineup.players.map(p => {
    const parts = fold(p.name).split(/\s+/);
    return parts[parts.length - 1];
  });
  lineup.players.forEach((player, slot) => {
    tokens.set(fold(player.name), slot);
    for (const alias of player.aliases ?? []) {
      tokens.set(fold(alias), slot);
    }
    const surname = surnames[slot];
    if (surnames.filter(s => s === surname).length === 1) {
      tokens.set(surname, slot);
    }
  });
  return tokens;
}

/** The slot whose accepted tokens contain the folded text, if any. */
export function matchGuess(lineup: FamousLineup, foldedText: string): number | undefined {
  return acceptedTokens(lineup).get(foldedText);
}

/**
 * Record a typed guess. Untargeted (no spot tapped), a correct name fills its
 * own slot wherever it is. Targeted at a spot, ONLY that spot's player counts:
 * a name that belongs elsewhere in the XI is a `'wrong-slot'` miss — strict
 * positional mode, the user's chosen ruleset. Naming a player already on the
 * sheet, or repeating the same wrong text at the same target, is a no-op —
 * misses never double-count. Blank input and finished games are no-ops too
 * (reported as `'repeat'`). The hit's `slot` is returned so the screen can
 * animate the right token.
 */
export function applyGuess(
  state: TeamsheetState,
  lineup: FamousLineup,
  rawText: string,
  targetSlot?: number,
): {state: TeamsheetState; outcome: GuessOutcome; slot?: number} {
  const text = fold(rawText);
  if (isFinished(state) || text.length === 0) {
    return {state, outcome: 'repeat'};
  }
  const matched = matchGuess(lineup, text);
  const found = foundSlots(state);
  if (targetSlot !== undefined && found.has(targetSlot)) {
    return {state, outcome: 'already-found', slot: targetSlot};
  }
  if (matched !== undefined && found.has(matched) && targetSlot === undefined) {
    return {state, outcome: 'already-found', slot: matched};
  }
  const hit = matched !== undefined && (targetSlot === undefined || matched === targetSlot);
  if (!hit && state.guesses.some(g => g.text === text && g.target === targetSlot)) {
    return {state, outcome: 'repeat'};
  }
  const guess: TeamsheetGuess =
    targetSlot === undefined
      ? hit
        ? {text, slot: matched}
        : {text}
      : hit
        ? {text, slot: matched, target: targetSlot}
        : {text, target: targetSlot};
  const guesses = [...state.guesses, guess];
  const won = hit && foundSlots({...state, guesses}).size === lineup.players.length;
  const status: GameStatus = won ? 'won' : 'playing';
  return {
    state: {...state, guesses, status},
    outcome: hit ? 'hit' : matched !== undefined ? 'wrong-slot' : 'miss',
    slot: hit ? matched : undefined,
  };
}

/** Throw in the towel: the sheet is revealed and the day ends unsolved. */
export function giveUp(state: TeamsheetState): TeamsheetState {
  if (isFinished(state)) {
    return state;
  }
  return {...state, status: 'revealed'};
}

/** The zero streak used before any sheet is completed. */
export const EMPTY_STREAK: StreakState = {
  current: 0,
  best: 0,
  lastCompletedDateKey: null,
};

/**
 * Fold a finished sheet into the streak. Completing all 11 with
 * [[STREAK_MISS_LIMIT]] misses or fewer the day after the last one extends
 * the streak; after a gap it restarts at 1; giving up or 6+ misses breaks
 * it. `best` never decreases. Pure — persistence lives in storage.ts.
 */
export function recordResult(
  streak: StreakState,
  dateKey: string,
  misses: number,
  gaveUp: boolean,
): StreakState {
  if (gaveUp || misses > STREAK_MISS_LIMIT) {
    return {...streak, current: 0};
  }
  const continues = streak.lastCompletedDateKey === previousDateKey(dateKey);
  const current = continues ? streak.current + 1 : 1;
  return {
    current,
    best: Math.max(streak.best, current),
    lastCompletedDateKey: dateKey,
  };
}

/** Build the history entry for a finished sheet. */
export function historyEntryFor(state: TeamsheetState): HistoryEntry {
  return {
    dateKey: state.dateKey,
    lineupId: state.lineupId,
    status: state.status === 'won' ? 'won' : 'revealed',
    found: foundSlots(state).size,
    misses: missCount(state),
  };
}

/** Merge a day's result into the log (last write wins for that day). Pure. */
export function upsertHistory(log: HistoryLog, entry: HistoryEntry): HistoryLog {
  return {...log, [entry.dateKey]: entry};
}
