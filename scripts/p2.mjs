// Dev-only "player 2" CLI — a second Supabase client so the lobby + game can be
// tested with one phone. Session persisted to /tmp/p2-session.json.
import {createClient} from '@supabase/supabase-js';
import fs from 'fs';
const url = 'https://hppsryxrdzxzusruftrj.supabase.co';
const key = 'sb_publishable_jHMICgkNwOnDs2NPmuEg-g_QIE5u2x3';
const SESSION = '/tmp/p2-session.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sb = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});

async function ensureSession() {
  if (fs.existsSync(SESSION)) {
    const s = JSON.parse(fs.readFileSync(SESSION, 'utf8'));
    const {data, error} = await sb.auth.setSession(s);
    if (!error && data.user) return data.user;
  }
  const {data, error} = await sb.auth.signInAnonymously();
  if (error) throw error;
  fs.writeFileSync(SESSION, JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }));
  return data.user;
}

// --- football matching (mirrors src/data/football/repository) ---
const {footballers, clubs} = JSON.parse(fs.readFileSync('/tmp/football.json', 'utf8'));
const clubById = Object.fromEntries(clubs.map(c => [c.id, c]));
const leaguesOf = f => [...new Set(f.clubs.map(s => clubById[s.clubId]?.league).filter(Boolean))];
function matches(f, c) {
  switch (c.kind) {
    case 'club': return f.clubs.some(s => s.clubId === c.clubId);
    case 'league': return leaguesOf(f).includes(c.league);
    case 'nationality': return f.nationality.includes(c.country);
    case 'position': return f.positions.includes(c.position);
    case 'honour': return f.honours.some(h => h.type === c.honour);
    case 'tag': return (f.tags || []).includes(c.tag);
    default: return false;
  }
}
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winnerOf(board) {
  for (const [a,b,c] of LINES) { const s = board[a]?.sideId; if (s && board[b]?.sideId === s && board[c]?.sideId === s) return s; }
  if (board.every(x => x)) {
    const cnt = {}; for (const cell of board) if (cell) cnt[cell.sideId] = (cnt[cell.sideId]||0)+1;
    let best=null,bn=-1,tie=false; for (const [k,n] of Object.entries(cnt)) { if (n>bn){best=k;bn=n;tie=false;} else if (n===bn) tie=true; }
    return tie || !best ? 'tie' : best;
  }
  return null;
}
function makeMove(st, uid) {
  const side = st.sides.find(s => s.memberUserIds.includes(uid));
  for (let i = 0; i < 9; i++) {
    if (st.board[i]) continue;
    const row = st.rows[Math.floor(i/3)], col = st.cols[i%3];
    const cand = footballers.find(f => !st.usedFootballerIds.includes(f.id) && matches(f, row) && matches(f, col));
    if (cand) {
      const board = st.board.slice();
      board[i] = {sideId: side.id, footballerId: cand.id};
      const winner = winnerOf(board);
      const idx = st.order.indexOf(uid);
      return {state: {...st, board, usedFootballerIds: [...st.usedFootballerIds, cand.id], winner, turnUserId: winner ? st.turnUserId : st.order[(idx+1)%st.order.length]}, name: cand.name, cell: i};
    }
  }
  return null;
}

const [cmd, ...args] = process.argv.slice(2);
const user = await ensureSession();

if (cmd === 'join') {
  const {data, error} = await sb.rpc('join_room', {p_code: (args[0]||'').toUpperCase(), p_name: args[1] || 'Lionel Messiah'});
  if (error) { console.log('ERR', error.message); process.exit(1); }
  const room = Array.isArray(data) ? data[0] : data;
  console.log('JOINED', room.id, 'code', room.code, 'uid', user.id);
} else if (cmd === 'autoplay') {
  const roomId = args[0];
  console.log('autoplay watching', roomId, 'as uid', user.id);
  for (;;) {
    const {data: room} = await sb.from('rooms').select('status,game_state').eq('id', roomId).maybeSingle();
    if (!room) { console.log('room gone'); break; }
    const st = room.game_state;
    if (room.status !== 'in_progress' || !st) { process.stdout.write('.'); await sleep(2000); continue; }
    if (st.winner) { console.log('\nGAME OVER →', st.winner); break; }
    if (st.turnUserId === user.id) {
      const mv = makeMove(st, user.id);
      if (mv) {
        const {error} = await sb.rpc('play_move', {p_room_id: roomId, p_state: mv.state});
        console.log(error ? '\nmove err '+error.message : `\nplayed ${mv.name} @cell ${mv.cell}`);
      } else {
        const idx = st.order.indexOf(user.id);
        await sb.rpc('play_move', {p_room_id: roomId, p_state: {...st, turnUserId: st.order[(idx+1)%st.order.length]}});
        console.log('\nno match found — passed turn');
      }
    }
    await sleep(2000);
  }
} else {
  console.log('usage: join <CODE> [name] | autoplay <roomId>');
}
