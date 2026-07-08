// Trophy illustrations for honour axis chips.
// PNGs now come from the ChatGPT trophy sheet via tools/art/slice-sheet.mjs
// (8 of 10). europa-league + domestic-cup are still the old script-generated
// art (scripts/build-trophy-assets.mjs) until replacements are generated —
// do NOT run that script; it would overwrite the new artwork.
/* eslint-disable */
export const TROPHY_IMAGES: Record<string, number> = {
  'world-cup': require('./trophies/world-cup.png'),
  'champions-league': require('./trophies/champions-league.png'),
  'europa-league': require('./trophies/europa-league.png'),
  'european-championship': require('./trophies/european-championship.png'),
  'copa-america': require('./trophies/copa-america.png'),
  'ballon-dor': require('./trophies/ballon-dor.png'),
  'golden-boot': require('./trophies/golden-boot.png'),
  'league-title': require('./trophies/league-title.png'),
  'domestic-cup': require('./trophies/domestic-cup.png'),
  'player-of-the-season': require('./trophies/player-of-the-season.png'),
};
