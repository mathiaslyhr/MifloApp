/**
 * Red Card question pool. Every round the app asks the whole table ONE generic
 * question about the secret footballer; the ids below are stable keys into the
 * `redCard.questions` i18n block, so `game_state` only ever carries ids and
 * each device renders the question in its own language.
 *
 * Questions are opinion/estimate style on purpose: anyone who knows the player
 * can answer instantly, there is no single correct answer to google, and the
 * faker can always bluff something plausible.
 */
import {shuffle, type Rng} from '../../data/football';

export const QUESTION_IDS = [
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10',
  'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18', 'q19', 'q20',
] as const;

/**
 * Pick `rounds` distinct question ids for a hand, skipping `avoid` (the
 * previous hand's questions, so Play again never repeats itself back to back).
 * The pool (20) is comfortably larger than rounds (max 4) plus avoid (max 4).
 */
export function buildQuestionIds(
  rounds: number,
  rng: Rng = Math.random,
  avoid: string[] = [],
): string[] {
  const pool = QUESTION_IDS.filter(id => !avoid.includes(id));
  return shuffle([...pool], rng).slice(0, rounds);
}
