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
  ],
};
