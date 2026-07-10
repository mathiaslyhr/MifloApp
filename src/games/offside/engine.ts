/**
 * Pure helpers for rendering Offside's shared room state. Everything derives
 * from the broadcast `OffsideState` (single source of truth), so a device that
 * rejoins mid-game lands in exactly the right view.
 */
import {getClub, type Criterion} from '../../data/football';
import type {OffsideRound, OffsideState} from './types';

/** A localized string reference: i18n key plus interpolation params. */
export type Explanation = {key: string; params: Record<string, string>};

/**
 * The reveal line for a round. Always phrased around the OUTLIER by name
 * ("{{name}} never played for {{club}}. The other three did.") — a bare
 * "three of them played for X" next to the highlighted odd one reads as if
 * the highlighted player were one of the X group. The generator only emits
 * honour (4 subtypes), nationality, club and position; anything else gets a
 * generic line rather than a crash. Country and club names interpolate as-is
 * (English data names, consistent with the rest of the app's criterion copy).
 */
export function explanationFor(round: OffsideRound): Explanation {
  const name = round.cards[round.outlierIndex]?.name ?? '';
  const criterion = round.criterion;
  switch (criterion.kind) {
    case 'honour':
      return {
        key: `offside.explanation.honour.${criterion.honour}`,
        params: {name},
      };
    case 'nationality':
      return {
        key: 'offside.explanation.nationality',
        params: {name, country: criterion.country},
      };
    case 'club':
      return {
        key: 'offside.explanation.club',
        params: {name, club: getClub(criterion.clubId)?.name ?? criterion.clubId},
      };
    case 'position':
      return {
        key: `offside.explanation.position.${criterion.position}`,
        params: {name},
      };
    default:
      return {key: 'offside.explanation.generic', params: {name}};
  }
}

/** The short category chip shown above the cards. */
export function topicKeyFor(criterion: Criterion): string {
  switch (criterion.kind) {
    case 'honour':
      return 'offside.topic.honours';
    case 'nationality':
      return 'offside.topic.nationality';
    case 'club':
      return 'offside.topic.clubs';
    case 'position':
      return 'offside.topic.positions';
    default:
      return 'offside.topic.mixed';
  }
}

export type StandingRow = {userId: string; name: string; score: number};

/** Players by score (desc), ties broken by name for a stable board. */
export function standings(state: OffsideState): StandingRow[] {
  return state.players
    .map(p => ({
      userId: p.userId,
      name: p.name,
      score: state.scores[p.userId] ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** Whether a player has submitted this round (a timed-out null still counts). */
export function hasAnswered(state: OffsideState, userId: string): boolean {
  return state.answers[userId] !== undefined;
}

/** Who we're still waiting on this round, in roster order. */
export function missingNames(state: OffsideState): string[] {
  return state.players
    .filter(p => !hasAnswered(state, p.userId))
    .map(p => p.name);
}

/** This round's points per user, for the reveal's score deltas. */
export function deltasOf(state: OffsideState): Record<string, number> {
  return Object.fromEntries(
    Object.entries(state.answers).map(([userId, a]) => [userId, a.points]),
  );
}

/** The current question deadline as epoch ms, or null outside questions. */
export function deadlineTs(state: OffsideState): number | null {
  if (!state.roundEndsAt) {
    return null;
  }
  const ts = Date.parse(state.roundEndsAt);
  return Number.isNaN(ts) ? null : ts;
}
