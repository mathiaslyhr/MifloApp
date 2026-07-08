// Illustrations for the non-honour axis chips.
// Most PNGs now come from the ChatGPT icons sheet via tools/art/slice-sheet.mjs
// (shirt-number, teammate, position-gk/df/mf, tag-current-stars); the rest
// (top-leagues, position-fw, tag-notable) are still from
// scripts/build-criteria-assets.mjs — do NOT run that script; it would
// overwrite the new artwork.
/* eslint-disable */
export const CRITERION_IMAGES: Record<string, number> = {
  'top-leagues': require('./criteria/top-leagues.png'),
  'shirt-number': require('./criteria/shirt-number.png'),
  'teammate': require('./criteria/teammate.png'),
  'position-gk': require('./criteria/position-gk.png'),
  'position-df': require('./criteria/position-df.png'),
  'position-mf': require('./criteria/position-mf.png'),
  'position-fw': require('./criteria/position-fw.png'),
  'tag-current-stars': require('./criteria/tag-current-stars.png'),
  'tag-notable': require('./criteria/tag-notable.png'),
};
