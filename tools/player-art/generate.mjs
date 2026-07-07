// Generate one portrait per player via Vercel AI Gateway (Nano Banana Pro).
// Consistency strategy: every request carries the SAME style-reference images
// and the SAME prompt template — only the player photo + jersey line change.
//
//   node generate.mjs                → all players missing from raw/
//   node generate.mjs messi walker   → only those (regenerates, overwrites)
//
// Needs AI_GATEWAY_API_KEY in ./.env (create a key in the Vercel dashboard
// under AI Gateway → API keys).
import 'dotenv/config';
import {readFileSync, writeFileSync, existsSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {generateText} from 'ai';
import {google} from '@ai-sdk/google';

const HERE = import.meta.dirname;
const RAW = resolve(HERE, 'raw');
// Preferred: a free Google AI Studio key (GOOGLE_GENERATIVE_AI_API_KEY) calls
// Gemini directly at $0. Fallback: Vercel AI Gateway slug (needs paid credits
// for image models despite the "free credits" — learned the hard way).
const useGoogle = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const MODEL = process.env.MODEL ?? (useGoogle ? google('gemini-2.5-flash-image') : 'google/gemini-2.5-flash-image');
const RATE_LIMIT_WAIT_MS = 35_000;
const MAX_TRIES = 8;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const {PLAYERS} = await import('./players.mjs');

const only = process.argv.slice(2);
const force = only.length > 0;
const targets = PLAYERS.filter(p =>
  only.length ? only.includes(p.file) : !existsSync(resolve(RAW, `${p.file}.png`)),
);
if (targets.length === 0) {
  console.log('Nothing to generate (raw/ is complete — pass filenames to redo).');
  process.exit(0);
}

const refs = readdirSync(resolve(HERE, 'refs'))
  .filter(f => f.endsWith('.png'))
  .sort()
  .map(f => readFileSync(resolve(HERE, 'refs', f)));
if (refs.length === 0) {
  throw new Error('No style refs — run: npm run prep');
}

const prompt = p =>
  `The first ${refs.length} images are examples from an established illustration series. ` +
  `Study their exact art style: flat-vector caricature bust portraits, cel-shaded with clean shapes, ` +
  `subtle two-tone skin shading, slightly caricatured proportions, head-and-shoulders crop, ` +
  `front-facing with a calm confident expression.\n\n` +
  `The last image is a photograph of the football player ${p.wiki.replace(/ \(.*\)$/, '')}. ` +
  `Create HIS portrait as the next entry in this series — identical art style, framing, ` +
  `level of detail, line quality and shading as the examples, and clearly recognizable as him ` +
  `(face shape, hairstyle, facial hair, skin tone).\n\n` +
  `He wears a ${p.jersey}. The jersey must be completely plain: no club crest, no badge, ` +
  `no brand logo, no sponsor, no text anywhere in the image, no watermark.\n\n` +
  `Background: one single flat uniform solid magenta (#FF00FF) filling everything behind him — ` +
  `no gradient, no shadow on the background.\n\n` +
  `Square image, head centered, portrait fills the frame like in the examples.`;

for (const p of targets) {
  const photoPath = resolve(HERE, 'photos', `${p.file}.jpg`);
  if (!existsSync(photoPath)) {
    console.error(`✗ ${p.file}: no photo — run: npm run photos`);
    continue;
  }
  const out = resolve(RAW, `${p.file}.png`);
  if (existsSync(out) && !force) {
    continue;
  }
  process.stdout.write(`… ${p.file} `);
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      const result = await generateText({
        model: MODEL,
        maxRetries: 0,
        messages: [
          {
            role: 'user',
            content: [
              ...refs.map(r => ({type: 'image', image: r})),
              {type: 'image', image: readFileSync(photoPath)},
              {type: 'text', text: prompt(p)},
            ],
          },
        ],
        providerOptions: {gateway: {tags: ['miflo:player-art']}},
      });
      const img = result.files.find(f => f.mediaType?.startsWith('image/'));
      if (!img) {
        console.error(`✗ no image returned (${result.text?.slice(0, 120) ?? 'no text'})`);
      } else {
        writeFileSync(out, img.uint8Array);
        console.log('✓');
      }
      break;
    } catch (err) {
      if (/rate.?limit/i.test(err.message) && attempt < MAX_TRIES) {
        process.stdout.write('⏳');
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }
      console.error(`✗ ${err.message}`);
      break;
    }
  }
}
