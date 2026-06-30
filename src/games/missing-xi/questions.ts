/**
 * Builds Missing XI questions from the curated famous lineups
 * (src/data/football/famousLineups.ts). Each question is one lineup with a
 * single random slot hidden; a lineup can yield more than one question (a
 * different hidden slot each time) when more questions than lineups are asked.
 *
 * Multiplayer note: generate the set ONCE per game (the host) and share it.
 * `rng` is injectable so tests are deterministic, mirroring the other games.
 */
import {FAMOUS_LINEUPS, sample, shuffle, type Rng} from '../../data/football';
import type {MissingQuestion} from './mockData';

export type BuildOptions = {rng?: Rng};

function questionFor(
  lineup: (typeof FAMOUS_LINEUPS)[number],
  hiddenIndex: number,
): MissingQuestion {
  return {
    lineupId: lineup.id,
    team: lineup.team,
    competition: lineup.competition,
    year: lineup.year,
    formation: lineup.formation,
    players: lineup.players,
    hiddenIndex,
  };
}

/**
 * Generate up to `count` questions. Each lineup contributes one question per
 * pass (a fresh hidden slot each time), so output only repeats a lineup once
 * every lineup has been used — and never repeats the same hidden slot.
 */
export function buildQuestions(
  count: number,
  options: BuildOptions = {},
): MissingQuestion[] {
  const {rng = Math.random} = options;
  const lineups = shuffle([...FAMOUS_LINEUPS], rng);
  if (lineups.length === 0) {
    return [];
  }

  // Per lineup, a shuffled queue of slot indices not yet hidden.
  const slotQueues = new Map<string, number[]>(
    lineups.map(l => [l.id, shuffle(l.players.map((_, i) => i), rng)]),
  );

  const questions: MissingQuestion[] = [];
  let exhausted = false;
  while (questions.length < count && !exhausted) {
    exhausted = true;
    for (const lineup of lineups) {
      if (questions.length >= count) {
        break;
      }
      const queue = slotQueues.get(lineup.id)!;
      const hiddenIndex = queue.pop();
      if (hiddenIndex === undefined) {
        continue; // this lineup is fully used
      }
      exhausted = false;
      questions.push(questionFor(lineup, hiddenIndex));
    }
  }
  // Light shuffle so consecutive questions aren't all distinct-lineup-then-repeat.
  return sample(questions, questions.length, rng);
}
