/**
 * How a Ball Knowledge group id becomes something you can look at. Same rule
 * as the profile favorites (0029): the wire carries the dataset's stable ids
 * (club slug, nation string) and art + names resolve at render time from the
 * bundled maps — so the board, the duel and the Home card can never disagree
 * about what "barcelona" looks like.
 */
import {getClub} from '../../data/football';
import {flagImage, logoImage, type ChipImage} from '../../games/hattrick/criterionIcon';
import type {BkDimension} from '../../core/social/ballKnowledgeService';

/** Display name for a group id; a stale slug falls back to the id itself. */
export function bkGroupName(dimension: BkDimension, groupId: string): string {
  if (dimension === 'club') {
    return getClub(groupId)?.name ?? groupId;
  }
  return groupId;
}

/** Crest (club) or flag (nation) for a group id; null when the art is absent. */
export function bkGroupImage(dimension: BkDimension, groupId: string): ChipImage {
  if (dimension === 'club') {
    return logoImage(groupId);
  }
  return flagImage(groupId);
}
