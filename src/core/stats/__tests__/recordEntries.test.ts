/**
 * recordEntries: turning a game's final board into the rows the host records,
 * and the stable per-instance match id that keeps rematches (same room) apart.
 */
import {entriesFromStandings, matchIdFrom, type Standing} from '../recordEntries';

describe('entriesFromStandings', () => {
  it('ranks by score (desc) and flags the top scorer as winner', () => {
    const board: Standing[] = [
      {userId: 'a', name: 'Ann', score: 3},
      {userId: 'b', name: 'Bo', score: 1},
      {userId: 'c', name: 'Cara', score: 5},
    ];
    const entries = entriesFromStandings(board);
    expect(entries.map(e => e.user_id)).toEqual(['c', 'a', 'b']);
    expect(entries.map(e => e.rank)).toEqual([1, 2, 3]);
    expect(entries.find(e => e.user_id === 'c')?.is_winner).toBe(true);
    expect(entries.find(e => e.user_id === 'a')?.is_winner).toBe(false);
  });

  it('shares a rank for a tie and crowns co-winners at the top', () => {
    const board: Standing[] = [
      {userId: 'a', name: 'Ann', score: 4},
      {userId: 'b', name: 'Bo', score: 4},
      {userId: 'c', name: 'Cara', score: 2},
    ];
    const entries = entriesFromStandings(board);
    expect(entries.map(e => e.rank)).toEqual([1, 1, 3]);
    expect(entries.filter(e => e.is_winner).map(e => e.user_id).sort()).toEqual([
      'a',
      'b',
    ]);
  });

  it('has no winner when nobody scored (a Hattrick 0/0 tie reads as a draw)', () => {
    const board: Standing[] = [
      {userId: 'a', name: 'Ann', score: 0},
      {userId: 'b', name: 'Bo', score: 0},
    ];
    const entries = entriesFromStandings(board);
    expect(entries.every(e => e.is_winner === false)).toBe(true);
  });
});

describe('matchIdFrom', () => {
  it('is stable for the same room + content (a reconnect re-records identically)', () => {
    expect(matchIdFrom('room-1', 'deck-abc')).toBe(matchIdFrom('room-1', 'deck-abc'));
  });

  it('differs for a rematch in the same room (fresh content)', () => {
    expect(matchIdFrom('room-1', 'deck-abc')).not.toBe(
      matchIdFrom('room-1', 'deck-xyz'),
    );
  });

  it('never collides across rooms (room id prefix)', () => {
    const a = matchIdFrom('room-1', 'same');
    const b = matchIdFrom('room-2', 'same');
    expect(a).not.toBe(b);
    expect(a.startsWith('room-1:')).toBe(true);
  });
});
