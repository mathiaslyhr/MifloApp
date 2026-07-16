/**
 * Pull a final's starting XIs straight out of Wikipedia's wikitext.
 *
 * The rendered page loses too much: a summariser read cards as substitutions
 * once and credited a substitute's goal to the XI. The wikitext carries
 * position, shirt, captain, cards, subs and scorers as explicit markup.
 *
 * Templates drift across eras, so nothing here is assumed:
 *  - `|goals1 =` may have any spacing, and its scorers may sit on the field
 *    line or on the lines under it.
 *  - shirt numbers appear as '''9''' AND as '''9 ''' (trailing space inside the
 *    bold) — the second silently cost Andy Cole his place in the 1999 XI.
 * Every XI is asserted to be exactly 11. A parser that quietly returns 10 is
 * worse than one that throws.
 *
 *   node lineup.mjs "1999_UEFA_Champions_League_final"
 */
const page = process.argv[2];
if (!page) {
  console.error('usage: node lineup.mjs <wikipedia_page_title>');
  process.exit(1);
}

const raw = await (
  await fetch(
    `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(page)}&action=raw`,
    {headers: {'User-Agent': 'MifloDataCuration/1.0 (mathiaslyhr@outlook.com)'}},
  )
).text();

const linkName = s => {
  const m = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(String(s));
  return m ? (m[2] ?? m[1]) : null;
};
const surname = s => String(s).trim().split(/\s+/).pop().toLowerCase();

/** A field's value plus any continuation lines under it, spacing-agnostic. */
function fieldBlock(name) {
  const re = new RegExp(`^\\|\\s*${name}\\s*=\\s*(.*)$`, 'm');
  const m = re.exec(raw);
  if (!m) return '';
  const after = raw.slice(m.index + m[0].length);
  const stop = after.search(/^\s*\|/m);
  return m[1] + '\n' + (stop < 0 ? '' : after.slice(0, stop));
}

/** goals1/goals2 → {name: count}; own goals are tagged, never credited. */
function scorers(which) {
  const block = fieldBlock(`goals${which}`);
  const out = {};
  for (const line of block.split('*').slice(1)) {
    const name = linkName(line);
    const g = /\{\{goal\|([^}]+)\}\}/.exec(line);
    if (!name || !g) continue;
    if (/o\.g\.|\(og\)/i.test(line)) {
      out[`(OG) ${name}`] = 1;
      continue;
    }
    out[name] = (out[name] ?? 0) + g[1].split('|').length;
  }
  return out;
}

// '''9''' and '''9 ''' both count.
const POS = /^\|([A-Z]{2,3})\s*\|\|'''(\d+)\s*'''\s*\|\|(.*)$/;
const rows = [];
const at = [];
for (const line of raw.split('\n')) {
  const m = POS.exec(line.trim());
  if (m) {
    rows.push({pos: m[1], shirt: +m[2], rest: m[3]});
    at.push(raw.indexOf(line));
  }
}
// Older pages say "Substitutions:", newer ones "Substitutes:".
const subIdx = [...raw.matchAll(/Substitut(?:es|ions):/g)].map(m => m.index);
if (subIdx.length < 2) {
  throw new Error(`expected 2 substitutes markers, found ${subIdx.length}`);
}
/** XI₁, "Substitutes:", subs₁, XI₂, "Substitutes:", subs₂ */
const startersFor = t => {
  const xi =
    t === 0
      ? rows.filter((_, i) => at[i] < subIdx[0]).slice(0, 11)
      : rows.filter((_, i) => at[i] > subIdx[0] && at[i] < subIdx[1]).slice(-11);
  if (xi.length !== 11) {
    throw new Error(`team ${t + 1}: parsed ${xi.length} starters, expected 11`);
  }
  return xi;
};

const team1 = linkName(fieldBlock('team1')) ?? '?';
const team2 = linkName(fieldBlock('team2')) ?? '?';
const score = fieldBlock('score').trim().split('\n')[0];

function describe(t, teamName, goals) {
  console.log(`\n=== ${teamName} — starting XI ===`);
  const seen = new Set();
  for (const r of startersFor(t)) {
    const name = linkName(r.rest);
    const key = Object.keys(goals).find(k => surname(k) === surname(name));
    if (key) seen.add(key);
    const tags = [
      goals[key] ? `goals:${goals[key]}` : '',
      /\|c\]\]\)/.test(r.rest) ? 'CAPTAIN' : '',
      /\{\{yel\|/.test(r.rest) ? 'yellow' : '',
      /\{\{(sent ?off|red)\|/i.test(r.rest) ? 'RED' : '',
      (/\{\{suboff\|(\d+)/.exec(r.rest) ?? [])[1]
        ? `subbedOff:${/\{\{suboff\|(\d+)/.exec(r.rest)[1]}'`
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    console.log(
      `  ${String(r.shirt).padStart(2)} ${r.pos.padEnd(3)} ${String(name).padEnd(24)} ${tags}`,
    );
  }
  // Scorers not in the XI came off the bench — the entry must not record them.
  const bench = Object.keys(goals).filter(k => !seen.has(k));
  if (bench.length) console.log(`  ‼ scored but NOT in the XI: ${bench.join(', ')}`);
}

console.log(`PAGE : ${page}`);
console.log(`MATCH: ${team1} ${score} ${team2}`);
const g1 = scorers(1);
const g2 = scorers(2);
describe(0, team1, g1);
describe(1, team2, g2);
