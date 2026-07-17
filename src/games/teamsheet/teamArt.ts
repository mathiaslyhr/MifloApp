/**
 * The daily Team sheet's public identity as art: a club's crest, or a nation's
 * flag. The team is announced in-game (the puzzle is literally "name this XI"),
 * so surfacing it spoils nothing. Home shows it as the daily lead; a lineup we
 * can't resolve to bundled art falls back to the kit colour.
 */
import type {ImageSourcePropType} from 'react-native';
import {FLAG_IMAGES} from '../hattrick/assets/flags.generated';
import {LOGO_IMAGES} from '../hattrick/assets/logos.generated';

export type TeamArt =
  | {kind: 'flag'; source: ImageSourcePropType}
  | {kind: 'crest'; source: ImageSourcePropType};

/** Club display names whose crest slug isn't a plain slugify of the name. */
const CLUB_SLUG: Record<string, string> = {
  'Bayer Leverkusen': 'leverkusen',
  'Bayern Munich': 'bayern',
  'Borussia Dortmund': 'dortmund',
  'Inter Milan': 'inter',
  'Leicester City': 'leicester',
  'Manchester City': 'man-city',
  'Manchester United': 'man-utd',
  'Paris Saint-Germain': 'psg',
  'Tottenham Hotspur': 'tottenham',
};

/** Historical nation names that reuse a present-day flag. */
const NATION_FLAG: Record<string, string> = {
  'West Germany': 'Germany',
};

/** Lowercase, strip accents, non-alphanumerics → single dashes. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Flag for a nation, crest for a club, or null when neither is bundled. */
export function teamArt(team: string): TeamArt | null {
  const flag = FLAG_IMAGES[NATION_FLAG[team] ?? team];
  if (flag !== undefined) {
    return {kind: 'flag', source: flag};
  }
  const logo = LOGO_IMAGES[CLUB_SLUG[team] ?? slugify(team)];
  if (logo !== undefined) {
    return {kind: 'crest', source: logo};
  }
  return null;
}
