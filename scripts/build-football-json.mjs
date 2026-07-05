// Serialize the TypeScript football dataset to /tmp/football.json so the p2
// autoplay tester (scripts/p2.mjs) matches cells against the SAME data the app
// ships. Run whenever footballers.ts / clubs.ts change:
//
//   npm run data:build
//
// p2.mjs reads `{footballers, clubs}` from /tmp/football.json (see p2.mjs:27).
import {writeFileSync} from 'node:fs';
import {FOOTBALLERS, CLUBS} from './_load-football.mjs';

const OUT = '/tmp/football.json';

writeFileSync(
  OUT,
  JSON.stringify({footballers: FOOTBALLERS, clubs: CLUBS}, null, 2),
);

console.log(
  `✓ ${OUT} — ${FOOTBALLERS.length} footballers, ${CLUBS.length} clubs`,
);
