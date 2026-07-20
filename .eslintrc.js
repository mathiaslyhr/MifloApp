module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      /**
       * Pass-and-play containers hold the game's secrets in memory (Red Card's
       * imposter and footballer). Their local state extends the broadcast state,
       * so TypeScript would happily accept shipping one through a room RPC —
       * which would put the imposter on the wire for every device to read.
       *
       * There is no room in flight mode, so there is never a reason to reach for
       * the transport here. This makes that mechanical rather than a convention.
       */
      files: ['src/screens/*LocalScreen.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/core/rooms', '**/core/rooms/*'],
                message:
                  'Pass-and-play is offline and holds the secrets in memory: never send local state to a room.',
              },
            ],
          },
        ],
      },
    },
    {
      /**
       * Design-system guards (docs/design.md). Everything outside `src/theme`
       * should reach for a token rather than a literal — colours via
       * `useColors()`/`useThemedStyles()`, type via `<Text variant>`.
       *
       * These are WARNINGS on purpose. There is a real tail of legitimate
       * exceptions (fixed-geometry board cells that can't take a scale step,
       * the two football-fixed card colours), and turning those into errors
       * would mean either a wave of disable comments or a red build nobody can
       * fix in one sitting. A warning still shows up in review, which is where
       * a new hardcoded hex actually gets caught. Promote to 'error' once the
       * existing offenders are cleared.
       */
      files: ['src/**/*.tsx', 'src/**/*.ts'],
      // `src/data` is football FACTS, not design: the lineup files carry real
      // kit colours (228 hexes across the finals alone), which are as much data
      // as the shirt numbers beside them and must never resolve to a theme
      // token. `src/theme` is where the tokens are defined in the first place.
      excludedFiles: ['src/theme/**', 'src/data/**', 'src/**/__tests__/**'],
      rules: {
        'no-restricted-syntax': [
          'warn',
          {
            selector:
              "Property[key.name='fontSize'][value.type='Literal']",
            message:
              'Use a type-scale variant (<Text variant="…">) instead of a raw fontSize. If this is a fixed-geometry board cell, add an eslint-disable with the reason.',
          },
          {
            selector:
              "Property[key.name='fontWeight']",
            message:
              'The type scale carries weight (Satoshi Regular/Medium only, never bold). Pick a variant instead of fontWeight.',
          },
          {
            selector:
              "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
            message:
              'Hardcoded hex. Read colours from useColors()/useThemedStyles() so both themes stay honest.',
          },
        ],
      },
    },
  ],
};
