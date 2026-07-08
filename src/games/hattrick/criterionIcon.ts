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
import {CRITERION_IMAGES} from './assets/criteria.generated';
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

/**
 * Real bundled image for an axis criterion, or null. Every criterion kind now
 * resolves to a custom vector (flags/crests/trophies plus the criteria set), so
 * a chip is never an emoji — the only fallback is a country without a flag PNG.
 */
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
      // Player illustration when supplied, else the generic teammate vector.
      return PLAYER_AVATARS[c.playerId] ?? CRITERION_IMAGES.teammate ?? null;
    case 'tag':
      return CRITERION_IMAGES[c.tag === 'current-stars' ? 'tag-current-stars' : 'tag-notable'] ?? null;
    case 'position':
      return CRITERION_IMAGES[`position-${c.position.toLowerCase()}`] ?? null;
    case 'shirtNumber':
      // No icon — the number renders as text (Scout "#23" style).
      return null;
    case 'topLeagues':
      return CRITERION_IMAGES['top-leagues'] ?? null;
    default:
      return null;
  }
}

/**
 * Text fallback for a chip when no image is bundled. Only the nationality flag
 * emoji remains, as a fallback for a country without a flag PNG; every other
 * criterion renders a vector via `criterionImage`.
 */
export function criterionIcon(c: Criterion): string | null {
  return c.kind === 'nationality' ? flagOf(c.country) : null;
}
