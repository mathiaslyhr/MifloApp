/**
 * Emoji iconography for grid axis chips — the visual layer that turns a bare
 * `Criterion` label into something closer to a real football-grid game (flags
 * for nations, trophies for honours, etc.). Pure presentation; the matching
 * logic and text labels stay in engine.ts / grid.ts.
 */
import type {Criterion} from '../../data/football';
import {FLAG_IMAGES} from './assets/flags.generated';
import {LOGO_IMAGES} from './assets/logos.generated';
import {TROPHY_IMAGES} from './assets/trophies.generated';
import {PLAYER_AVATARS} from './assets/playerAvatars';

/**
 * Full English country name → flag emoji. Keyed to the exact strings used in
 * the dataset (footballer nationalities + club countries). England/Scotland use
 * the ISO 3166-2 subdivision "tag" flags — a plain regional-indicator pair does
 * not exist for them.
 */
export const COUNTRY_FLAGS: Record<string, string> = {
  // Player nationalities present in the dataset.
  Germany: '🇩🇪',
  Italy: '🇮🇹',
  Argentina: '🇦🇷',
  Spain: '🇪🇸',
  Brazil: '🇧🇷',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Portugal: '🇵🇹',
  France: '🇫🇷',
  Belgium: '🇧🇪',
  Netherlands: '🇳🇱',
  Uruguay: '🇺🇾',
  Norway: '🇳🇴',
  Denmark: '🇩🇰',
  Ghana: '🇬🇭',
  Senegal: '🇸🇳',
  Japan: '🇯🇵',
  'Ivory Coast': '🇨🇮',
  Ukraine: '🇺🇦',
  Sweden: '🇸🇪',
  'South Korea': '🇰🇷',
  Serbia: '🇷🇸',
  Poland: '🇵🇱',
  Nigeria: '🇳🇬',
  Morocco: '🇲🇦',
  Liberia: '🇱🇷',
  Georgia: '🇬🇪',
  Gabon: '🇬🇦',
  Egypt: '🇪🇬',
  'Czech Republic': '🇨🇿',
  Croatia: '🇭🇷',
  Colombia: '🇨🇴',
  Cameroon: '🇨🇲',
  Algeria: '🇩🇿',
  // Club-only countries (appear via Club.country, handy for player flags too).
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  USA: '🇺🇸',
  Canada: '🇨🇦',
  'Saudi Arabia': '🇸🇦',
  Mexico: '🇲🇽',
  Turkey: '🇹🇷',
};

/** Flag emoji for a country name, or null if we don't have one. */
export function flagOf(country: string | undefined): string | null {
  return (country && COUNTRY_FLAGS[country]) || null;
}

/**
 * Real bundled asset ids (Metro require handles) — the preferred visual layer.
 * `flags.generated.ts` / `logos.generated.ts` are produced by
 * `npm run assets:flags` / `assets:logos`. Emoji above stay as the fallback for
 * anything without a real image.
 */

/** Real flag image (Image source id) for a country, or null. */
export function flagImage(country: string | undefined): number | null {
  return country ? FLAG_IMAGES[country] ?? null : null;
}

/** Real club crest image (Image source id) for a clubId, or null. */
export function logoImage(clubId: string | undefined): number | null {
  return clubId ? LOGO_IMAGES[clubId] ?? null : null;
}

/** Real bundled image for an axis criterion, or null (emoji fallback then applies). */
export function criterionImage(c: Criterion): number | null {
  switch (c.kind) {
    case 'nationality':
      return flagImage(c.country);
    case 'club':
      return logoImage(c.clubId);
    case 'honour':
      // Custom vector trophy illustration (assets/trophies).
      return TROPHY_IMAGES[c.honour] ?? null;
    case 'teammate':
      // Player illustration, once supplied (assets/players + playerAvatars.ts).
      return PLAYER_AVATARS[c.playerId] ?? null;
    default:
      return null;
  }
}

const HONOUR_ICONS: Record<string, string> = {
  'champions-league': '🏆',
  'europa-league': '🏆',
  'league-title': '🏆',
  'domestic-cup': '🏆',
  'world-cup': '🌍',
  'european-championship': '🌍',
  'ballon-dor': '🏅',
  'golden-boot': '👟',
  'copa-america': '🌎',
  'player-of-the-season': '⭐',
};

const POSITION_ICONS: Record<string, string> = {
  GK: '🧤',
  DF: '🛡️',
  MF: '🎯',
  FW: '⚽',
};

/** Emoji for an axis chip, or null for text-only chips (club / league). */
export function criterionIcon(c: Criterion): string | null {
  switch (c.kind) {
    case 'nationality':
      return flagOf(c.country);
    case 'honour':
      return HONOUR_ICONS[c.honour] ?? '🏆';
    case 'tag':
      return c.tag === 'current-stars' ? '🔥' : '⭐';
    case 'position':
      return POSITION_ICONS[c.position] ?? null;
    case 'shirtNumber':
      return '👕';
    case 'teammate':
      return '🤝';
    case 'topLeagues':
      return '🌐';
    case 'club':
    case 'league':
      return null;
  }
}
