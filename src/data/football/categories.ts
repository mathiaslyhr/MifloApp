/**
 * Maps quiz topic ids (see TOPICS in src/games/quiz/mockData.ts) to the
 * criteria that define category membership. Keeping this here — not in the
 * quiz — lets other games reuse the same category definitions.
 *
 * A category is the AND of its criteria; an empty list matches everyone.
 * 'champions-league' / 'world-cup' currently mean "won it"; widen later by
 * adding criteria kinds if needed.
 */
import type {Criterion} from './types';

export type Category = {
  id: string;
  criteria: readonly Criterion[];
};

export const CATEGORIES: readonly Category[] = [
  {id: 'all', criteria: []},
  {id: 'premier-league', criteria: [{kind: 'league', league: 'premier-league'}]},
  {id: 'la-liga', criteria: [{kind: 'league', league: 'la-liga'}]},
  {id: 'serie-a', criteria: [{kind: 'league', league: 'serie-a'}]},
  {id: 'bundesliga', criteria: [{kind: 'league', league: 'bundesliga'}]},
  {id: 'ligue-1', criteria: [{kind: 'league', league: 'ligue-1'}]},
  {id: 'champions-league', criteria: [{kind: 'honour', honour: 'champions-league'}]},
  {id: 'world-cup', criteria: [{kind: 'honour', honour: 'world-cup'}]},
  {id: 'ballon-dor', criteria: [{kind: 'honour', honour: 'ballon-dor'}]},
  {id: 'legends', criteria: [{kind: 'tag', tag: 'legends'}]},
  {id: 'current-stars', criteria: [{kind: 'tag', tag: 'current-stars'}]},
];

const CATEGORIES_BY_ID: ReadonlyMap<string, Category> = new Map(
  CATEGORIES.map(category => [category.id, category]),
);

export function getCategory(topicId: string): Category | undefined {
  return CATEGORIES_BY_ID.get(topicId);
}
