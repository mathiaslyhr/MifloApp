/**
 * Top Bins metric — WHAT a list is ranked by (goals, titles, …), the one axis
 * every list shares. It drives the daily lead icon on Home, and because a
 * metric is never one of the answers, surfacing it can't spoil the board.
 *
 * Tagged explicitly per list id (the id is permanent; the title/kind alone
 * aren't enough to tell goals from an award). A new, untagged list falls back
 * by `kind` until it's added here.
 */
import type {TenballList} from './types';

export type TenballMetric =
  | 'goals'
  | 'apps'
  | 'assists'
  | 'titles'
  | 'awards'
  | 'transfers'
  | 'venue';

const METRIC_BY_ID: Record<string, TenballMetric> = {
  // goals — raw scoring counts, plus the golden-boot (top-scorer) awards
  'pl-top-scorers': 'goals',
  'ucl-top-scorers': 'goals',
  'serie-a-top-scorers': 'goals',
  'wc-top-scorers': 'goals',
  'intl-goals-men': 'goals',
  'dk-top-scorers': 'goals',
  'man-united-top-scorers': 'goals',
  'liverpool-top-scorers': 'goals',
  'real-madrid-top-scorers': 'goals',
  'arsenal-top-scorers': 'goals',
  'pl-goals-season': 'goals',
  'wc-goals-tournament': 'goals',
  'last-10-wc-golden-boot': 'goals',
  'last-10-pl-golden-boot': 'goals',
  // appearances / caps
  'pl-most-appearances': 'apps',
  'wc-most-matches': 'apps',
  'dk-most-caps': 'apps',
  'man-united-appearances': 'apps',
  'liverpool-appearances': 'apps',
  // assists
  'pl-most-assists': 'assists',
  // titles — clubs, nations, and title-winning managers
  'last-10-cl-winners': 'titles',
  'last-10-europa-winners': 'titles',
  'last-10-fa-cup-winners': 'titles',
  'last-10-english-champions': 'titles',
  'last-10-serie-a-champions': 'titles',
  'last-10-superliga-champions': 'titles',
  'cl-titles-clubs': 'titles',
  'english-titles-clubs': 'titles',
  'serie-a-titles-clubs': 'titles',
  'german-titles-clubs': 'titles',
  'fa-cups-clubs': 'titles',
  'euro-titles-nations': 'titles',
  'last-10-cl-managers': 'titles',
  'last-10-pl-managers': 'titles',
  // individual awards
  'most-ballon-dor': 'awards',
  'last-10-ballon-dor': 'awards',
  'last-10-wc-golden-ball': 'awards',
  'last-10-pfa-poty': 'awards',
  'last-10-african-poty': 'awards',
  // money
  'record-transfers': 'transfers',
  // place
  'last-10-cl-final-cities': 'venue',
};

/** The metric a list is ranked by; falls back by `kind` for an untagged list. */
export function listMetric(list: TenballList): TenballMetric {
  const tagged = METRIC_BY_ID[list.id];
  if (tagged) {
    return tagged;
  }
  switch (list.kind) {
    case 'club':
    case 'nation':
    case 'manager':
      return 'titles';
    default:
      return 'goals';
  }
}
