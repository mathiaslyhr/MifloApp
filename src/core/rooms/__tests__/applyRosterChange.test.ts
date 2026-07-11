/**
 * Realtime roster maintenance: player INSERT/UPDATE/DELETE payloads are
 * applied directly to the in-memory roster (sorted by join time, like
 * fetchPlayers) instead of refetching the whole list on every change.
 * Unusable payloads return null so the subscriber falls back to a refetch.
 */
import {applyRosterChange} from '../roomService';
import type {RoomPlayer} from '../types';

const row = (id: string, joinedAt: string, score = 0, name = id) => ({
  id,
  room_id: 'r1',
  user_id: `u-${id}`,
  name,
  is_host: false,
  score,
  joined_at: joinedAt,
});

const player = (id: string, joinedAt: string, score = 0): RoomPlayer => ({
  id,
  roomId: 'r1',
  userId: `u-${id}`,
  name: id,
  isHost: false,
  score,
  joinedAt,
  avatarPath: null,
});

test('INSERT adds the player in join order', () => {
  const roster = [player('a', '2026-01-01T10:00:00Z')];
  const next = applyRosterChange(roster, {
    eventType: 'INSERT',
    new: row('b', '2026-01-01T09:00:00Z'),
  });
  expect(next?.map(p => p.id)).toEqual(['b', 'a']);
});

test('UPDATE replaces the row without reordering (score change)', () => {
  const roster = [player('a', '2026-01-01T10:00:00Z'), player('b', '2026-01-01T11:00:00Z')];
  const next = applyRosterChange(roster, {
    eventType: 'UPDATE',
    new: row('a', '2026-01-01T10:00:00Z', 5),
  });
  expect(next?.map(p => [p.id, p.score])).toEqual([['a', 5], ['b', 0]]);
});

test('DELETE removes by id even when only the key survives in old', () => {
  const roster = [player('a', '2026-01-01T10:00:00Z'), player('b', '2026-01-01T11:00:00Z')];
  const next = applyRosterChange(roster, {eventType: 'DELETE', old: {id: 'b'}});
  expect(next?.map(p => p.id)).toEqual(['a']);
});

test('unusable payloads return null so the caller refetches', () => {
  const roster = [player('a', '2026-01-01T10:00:00Z')];
  expect(applyRosterChange(roster, {eventType: 'DELETE', old: {}})).toBeNull();
  expect(applyRosterChange(roster, {eventType: 'INSERT'})).toBeNull();
  expect(applyRosterChange(roster, {eventType: 'WEIRD'})).toBeNull();
});

test('does not mutate the input roster', () => {
  const roster = [player('a', '2026-01-01T10:00:00Z')];
  applyRosterChange(roster, {eventType: 'INSERT', new: row('b', '2026-01-01T11:00:00Z')});
  expect(roster.map(p => p.id)).toEqual(['a']);
});
