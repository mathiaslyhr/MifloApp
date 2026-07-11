import { FOOTBALLERS } from './src/data/football/footballers.ts';
const out = FOOTBALLERS.map(f => {
  const clubs = f.clubs.map(c => c.clubId).join(',');
  const hon = (f.honours||[]).map(h=>h.type).join(',');
  const hasDC = (f.honours||[]).some(h=>h.type==='domestic-cup');
  return `${hasDC?'DC':'  '}\t${f.id}\t[${clubs}]\t{${hon}}`;
}).join('\n');
console.log(out);
console.log('TOTAL', FOOTBALLERS.length);
