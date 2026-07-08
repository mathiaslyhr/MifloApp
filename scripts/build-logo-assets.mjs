// Download real club crest SVGs (footylogos.com — "used for identification
// purposes only"; trademarks belong to the respective clubs) for every club a
// footballer references, rasterize them to small transparent PNGs, and emit a
// committed require-map so the app renders real badges offline via a native
// <Image> (fast; detailed crests would be far too heavy as runtime SVG).
//
//   npm run assets:logos
//
// Outputs:
//   src/games/hattrick/assets/logos/<clubId>.png     (bundled images)
//   src/games/hattrick/assets/logos.generated.ts     (require map)
//     export const LOGO_IMAGES: Record<clubId, number>
//
// clubId → footylogos slug. When adding a club, add its slug here; the script
// falls back to a slugified club name and fails loudly on any 404 so a missing
// crest can't ship silently.
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {FOOTBALLERS, CLUBS, root} from './_load-football.mjs';

const BUCKET = 'https://pub-3bd35431294c47068cbf31a95d572166.r2.dev/logos';
const LOGO_SIZE = 96; // ~3x of the ~28–32pt crest chip; crest fit inside, square.

// clubId → footylogos slug (verified via probe; extend per dataset batch).
const CLUB_SLUG = {
  'man-city': 'manchester-city', 'man-utd': 'manchester-united',
  arsenal: 'arsenal', chelsea: 'chelsea', liverpool: 'liverpool-fc',
  tottenham: 'tottenham-hotspur', 'aston-villa': 'aston-villa',
  everton: 'everton', newcastle: 'newcastle-united', 'west-ham': 'west-ham-united',
  leicester: 'leicester', leeds: 'leeds-united', wolves: 'wolverhampton-wanderers',
  southampton: 'southampton', qpr: 'queens-park-rangers', barnsley: 'barnsley',
  fulham: 'fulham',
  'real-madrid': 'real-madrid', barcelona: 'fc-barcelona',
  'atletico-madrid': 'atletico-madrid', sevilla: 'sevilla-fc', valencia: 'valencia-cf',
  villarreal: 'villarreal-cf', 'real-sociedad': 'real-sociedad',
  'real-betis': 'real-betis-balompie', juventus: 'juventus', inter: 'inter-milan',
  'ac-milan': 'ac-milan', napoli: 'napoli', roma: 'roma', lazio: 'lazio',
  fiorentina: 'fiorentina', atalanta: 'atalanta', bologna: 'bologna',
  bayern: 'bayern-munich', dortmund: 'borussia-dortmund', leverkusen: 'bayer-leverkusen',
  schalke: 'schalke-04', 'rb-leipzig': 'rb-leipzig', wolfsburg: 'vfl-wolfsburg',
  monchengladbach: 'borussia-monchengladbach', psg: 'paris-saint-germain-psg',
  monaco: 'as-monaco', marseille: 'olympique-de-marseille-om', lyon: 'olympique-lyonnais',
  lille: 'losc-lille', rennes: 'stade-rennais', 'paris-fc': 'paris-fc',
  'inter-miami': 'inter-miami', lafc: 'los-angeles-fc', 'la-galaxy': 'la-galaxy',
  vancouver: 'vancouver-whitecaps', 'al-nassr': 'al-nassr', 'al-hilal': 'al-hilal',
  'al-ittihad': 'al-ittihad', 'al-qadsiah': 'al-qadsiah', 'al-ahli': 'al-ahli',
  sporting: 'sporting-cp', benfica: 'sl-benfica', porto: 'fc-porto', ajax: 'ajax',
  santos: 'santos-fc', fluminense: 'fluminense', flamengo: 'flamengo',
  palmeiras: 'palmeiras',
  'boca-juniors': 'boca-juniors', 'river-plate': 'river-plate',
  'rosario-central': 'rosario-central', monterrey: 'monterrey',
  galatasaray: 'galatasaray', besiktas: 'besiktas', celtic: 'celtic',
  fenerbahce: 'fenerbahce',
  // WC 2026 batch: CONCACAF / hosts / OFC
  'nottingham-forest': 'nottingham-forest', 'crystal-palace': 'crystal-palace',
  bournemouth: 'afc-bournemouth', burnley: 'burnley', brentford: 'brentford',
  'werder-bremen': 'werder-bremen', psv: 'psv-eindhoven', feyenoord: 'feyenoord',
  genoa: 'genoa', nice: 'ogc-nice', 'club-brugge': 'club-brugge',
  'club-america': 'club-america', guadalajara: 'cd-guadalajara',
  tigres: 'tigres-uanl', 'cruz-azul': 'cruz-azul', pumas: 'pumas-unam',
  pachuca: 'pachuca', toluca: 'toluca', 'real-mallorca': 'rcd-mallorca',
  brighton: 'brighton-and-hove-albion', anderlecht: 'rsc-anderlecht', twente: 'fc-twente',
  girona: 'girona-fc',
  // WC 2026 batch: AFC
  'eintracht-frankfurt': 'eintracht-frankfurt', 'vfb-stuttgart': 'vfb-stuttgart',
  freiburg: 'sc-freiburg', parma: 'parma', genk: 'krc-genk', lens: 'rc-lens',
  montpellier: 'montpellier', 'al-sadd': 'al-sadd-sc', 'al-duhail': 'al-duhail-sc',
  reims: 'stade-de-reims',
  // WC 2026 batch: CAF
  'athletic-bilbao': 'athletic-club-bilbao', torino: 'torino', nantes: 'fc-nantes',
  'al-ahly': 'al-ahly-sc', 'mamelodi-sundowns': 'mamelodi-sundowns',
  toulouse: 'toulouse-fc', metz: 'fc-metz', lorient: 'fc-lorient', empoli: 'empoli-fc',
  udinese: 'udinese', trabzonspor: 'trabzonspor', sunderland: 'sunderland',
  'bristol-city': 'bristol-city', 'union-sg': 'union-saint-gilloise', basel: 'fc-basel',
  // WC 2026 batch: CONMEBOL
  getafe: 'getafe-cf', como: 'como-1907', internacional: 'sc-internacional', botafogo: 'botafogo',
  watford: 'watford', cagliari: 'cagliari', 'hertha-berlin': 'hertha-bsc', 'west-brom': 'west-bromwich-albion',
  // WC 2026 batch: UEFA
  hoffenheim: 'tsg-hoffenheim', 'union-berlin': 'union-berlin', mainz: 'mainz-05',
  'az-alkmaar': 'az-alkmaar', lecce: 'lecce', sampdoria: 'uc-sampdoria',
  'sheffield-united': 'sheffield-united', salzburg: 'red-bull-salzburg',
  'dinamo-zagreb': 'gnk-dinamo-zagreb', midtjylland: 'fc-midtjylland', copenhagen: 'fc-copenhagen',
  shakhtar: 'shakhtar-donetsk', 'dynamo-kyiv': 'dynamo-kyiv', ferencvaros: 'ferencvaros-tc',
  olympiacos: 'olympiacos', augsburg: 'fc-augsburg', spezia: 'spezia',
  norwich: 'norwich-city', 'al-shabab': 'al-shabab',
  // Curation batch 2026-07
  gremio: 'gremio', hamburg: 'hamburger-sv', blackburn: 'blackburn-rovers',
  'celta-vigo': 'celta-vigo', corinthians: 'corinthians',
  stoke: 'stoke-city', bolton: 'bolton-wanderers',
  kaiserslautern: 'fc-kaiserslautern', 'saint-etienne': 'as-saint-etienne',
  elche: 'elche-cf', cannes: 'as-cannes',
};

const slugify = s =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Only fetch crests for clubs that a footballer actually references — keeps the
// bundle to clubs that can appear on a grid axis.
const usedClubIds = new Set();
for (const f of FOOTBALLERS) for (const s of f.clubs) usedClubIds.add(s.clubId);
const clubs = CLUBS.filter(c => usedClubIds.has(c.id)).sort((a, b) =>
  a.id.localeCompare(b.id),
);

async function fetchLogo(slug) {
  const url = `${BUCKET}/${slug}/${slug}-logo-footylogos.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const dir = resolve(root, 'src/games/hattrick/assets');
  const imgDir = resolve(dir, 'logos');
  rmSync(imgDir, {recursive: true, force: true});
  mkdirSync(imgDir, {recursive: true});

  const entries = [];
  const failed = [];
  for (const club of clubs) {
    const slug = CLUB_SLUG[club.id] ?? slugify(club.name);
    try {
      const svg = await fetchLogo(slug);
      // Fit the crest inside a transparent square so every badge occupies the
      // same box regardless of its native aspect ratio.
      const png = await sharp(svg, {density: 300, limitInputPixels: false})
        .resize(LOGO_SIZE, LOGO_SIZE, {
          fit: 'contain',
          background: {r: 0, g: 0, b: 0, alpha: 0},
        })
        .png({compressionLevel: 9})
        .toBuffer();
      writeFileSync(resolve(imgDir, `${club.id}.png`), png);
      entries.push(club.id);
      console.log(`  ✓ ${club.id} (${slug}) ${png.length}b`);
    } catch (e) {
      failed.push(`${club.id} → tried "${slug}"`);
      console.error(`  ✗ ${club.id}: ${e.message}`);
    }
  }

  if (failed.length) {
    console.error(
      `\n✗ ${failed.length} crest(s) failed — add correct slugs to CLUB_SLUG:\n  ` +
        failed.join('\n  '),
    );
    process.exit(1);
  }

  const body = entries
    .map(id => `  ${JSON.stringify(id)}: require('./logos/${id}.png'),`)
    .join('\n');

  const out = `// AUTO-GENERATED by scripts/build-logo-assets.mjs — do not edit by hand.
// Real club crests (footylogos.com), rasterized + bundled for offline use.
// Trademarks belong to the respective clubs; used for identification purposes
// only. Values are Metro asset ids usable as <Image source>.
// Regenerate with: npm run assets:logos
/* eslint-disable */
export const LOGO_IMAGES: Record<string, number> = {
${body}
};
`;

  writeFileSync(resolve(dir, 'logos.generated.ts'), out);
  console.log(`✓ ${entries.length} crests → assets/logos/*.png + logos.generated.ts`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
