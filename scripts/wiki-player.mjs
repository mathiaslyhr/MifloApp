/**
 * Pull a footballer's DOB + senior career out of Wikipedia's infobox wikitext.
 *
 * `born` is required on every Footballer and must never be invented, so it is
 * read from {{birth date and age|Y|M|D}} and nothing else — no page, no entry.
 * Career rows come from years1/clubs1… ; caller decides which spells the app
 * actually knows (the Otamendi/Kolarov convention keeps only recognisable ones).
 *
 *   node player.mjs "Robert Huth" "Joe Hart" …
 */
const names = process.argv.slice(2);

async function raw(title) {
  const r = await fetch(
    `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`,
    {headers: {'User-Agent': 'MifloDataCuration/1.0 (mathiaslyhr@outlook.com)'}},
  );
  if (!r.ok) return null;
  const t = await r.text();
  // follow redirects
  const rd = /^#REDIRECT\s*\[\[([^\]]+)\]\]/i.exec(t.trim());
  return rd ? raw(rd[1]) : t;
}

const field = (txt, name) => {
  const m = new RegExp(`^\\|\\s*${name}\\s*=\\s*(.*)$`, 'm').exec(txt);
  return m ? m[1].trim() : '';
};

function dob(txt) {
  const m =
    /\{\{[Bb]irth date and age\s*(?:\|df=\w+)?\|(\d{4})\|(\d{1,2})\|(\d{1,2})/.exec(txt) ??
    /\{\{[Bb]irth date\s*(?:\|df=\w+)?\|(\d{4})\|(\d{1,2})\|(\d{1,2})/.exec(txt);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const linkName = s => {
  const m = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(String(s));
  return m ? (m[2] ?? m[1]) : String(s).replace(/\{\{[^}]*\}\}/g, '').trim();
};

for (const name of names) {
  const txt = await raw(name);
  if (!txt) {
    console.log(`\n### ${name}\n  !! NO PAGE`);
    continue;
  }
  const born = dob(txt);
  const nat = field(txt, 'birth_place');
  const pos = field(txt, 'position');
  console.log(`\n### ${name}`);
  console.log(`  born     : ${born ?? '!! NOT FOUND — do not invent'}`);
  console.log(`  position : ${linkName(pos)}`);
  console.log(`  birthplace: ${linkName(nat)}`);
  const spells = [];
  for (let i = 1; i <= 14; i++) {
    const yrs = field(txt, `years${i}`);
    const club = field(txt, `clubs${i}`);
    if (!yrs && !club) continue;
    const loan = /\(loan\)/i.test(club);
    spells.push(`${yrs.replace(/–/g, '-').padEnd(12)} ${linkName(club)}${loan ? '  [LOAN]' : ''}`);
  }
  console.log('  career   :');
  for (const s of spells) console.log(`     ${s}`);
  const natTeam = [];
  for (let i = 1; i <= 6; i++) {
    const t = field(txt, `nationalteam${i}`);
    if (t) natTeam.push(linkName(t));
  }
  if (natTeam.length) console.log(`  national : ${natTeam.join(' / ')}`);
}
