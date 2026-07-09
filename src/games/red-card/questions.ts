/**
 * Red Card question pool. Every round the app asks the whole table ONE generic
 * question about the secret footballer; the ids below are stable keys into the
 * `redCard.questions` i18n block, so `game_state` only ever carries ids and
 * each device renders the question in its own language.
 *
 * Questions are opinion/estimate style on purpose: anyone who knows the player
 * can answer instantly, there is no single correct answer to google, and the
 * faker can always bluff something plausible.
 *
 * Repeats: a session remembers every question it has asked (chronologically)
 * and always deals from the unasked ones first; only once the whole pool has
 * been heard do the longest-ago questions come back around.
 */
import {shuffle, type Rng} from '../../data/football';

// Ids are opaque keys and many have been retired (q7, q9, q13 to q15, q17,
// q22 to q25, q28: prime/rating clones, coin flips, too hard for the faker;
// q31 to q43: an off-pitch batch that wasn't football enough), so the gaps
// are intentional. Questions stay football-centred, opinion/estimate style.
export const QUESTION_IDS = [
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q8', 'q10', 'q11', 'q12',
  'q16', 'q18', 'q19', 'q20', 'q21', 'q26', 'q27', 'q29', 'q30',
  'q44', 'q45', 'q46', 'q47', 'q48', 'q49', 'q50', 'q51', 'q52',
  'q53', 'q54', 'q55', 'q56',
] as const;

const POOL: readonly string[] = QUESTION_IDS;

/**
 * Pick `rounds` distinct question ids, preferring ones not in `used`. `used`
 * is the session's chronological ask history (oldest first); when too few
 * unasked questions remain, the longest-ago ones fill the hand.
 */
export function buildQuestionIds(
  rounds: number,
  rng: Rng = Math.random,
  used: string[] = [],
): string[] {
  const fresh = POOL.filter(id => !used.includes(id));
  if (fresh.length >= rounds) {
    return shuffle([...fresh], rng).slice(0, rounds);
  }
  const refill = used
    .filter(id => POOL.includes(id))
    .slice(0, rounds - fresh.length);
  return shuffle([...fresh, ...refill], rng);
}

/** The ask history after a hand: `picked` moves to the (newest) end. */
export function rememberQuestions(used: string[], picked: string[]): string[] {
  return [...used.filter(id => !picked.includes(id)), ...picked];
}

// ── Online session memory ────────────────────────────────────────────────────
// Only the host device picks questions (start + Play again), so a small
// in-memory store keyed by roomId is enough to stop repeats across hands. It
// lives for the app run; a force-quit forgets it, which at worst repeats
// sooner than ideal.

const sessionUsed = new Map<string, string[]>();

/** Fold already-asked ids (e.g. the current hand) into a party's history. */
export function noteSessionQuestions(sessionKey: string, ids: string[]): void {
  sessionUsed.set(
    sessionKey,
    rememberQuestions(sessionUsed.get(sessionKey) ?? [], ids),
  );
}

/** Deal a hand's questions for a party and record them in its history. */
export function takeSessionQuestions(
  sessionKey: string,
  rounds: number,
  rng: Rng = Math.random,
): string[] {
  const used = sessionUsed.get(sessionKey) ?? [];
  const ids = buildQuestionIds(rounds, rng, used);
  sessionUsed.set(sessionKey, rememberQuestions(used, ids));
  return ids;
}
