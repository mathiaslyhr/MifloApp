/**
 * Personal stats service — reads this device's own game history from Supabase
 * (RLS scopes rows to auth.uid()) and aggregates it into career stats. Like
 * src/core/rooms/roomService.ts, this is the only place the app talks to the
 * backend for stats; the transport stays hidden here.
 */
import {BackendUnavailableError} from '../rooms/roomService';
import {ensureSession, supabase} from '../supabase/client';
import type {GameResult} from './types';

// Re-export the pure aggregation so callers have one stats entry point.
export {computeCareerStats} from './careerStats';

// Supabase returns snake_case rows; map them to our camelCase domain types.
function mapResult(row: any): GameResult {
  return {
    id: row.id,
    roomCode: row.room_code ?? null,
    gameType: row.game_type ?? 'quiz',
    name: row.name,
    score: row.score ?? 0,
    rank: row.rank ?? 0,
    isWinner: row.is_winner ?? false,
    totalPlayers: row.total_players ?? 0,
    topicIds: row.topic_ids ?? [],
    questionCount: row.question_count ?? null,
    playedAt: row.played_at,
  };
}

/** This device's finished games, newest first (RLS returns only our own rows). */
export async function fetchMyResults(): Promise<GameResult[]> {
  if (!supabase) {
    throw new BackendUnavailableError();
  }
  await ensureSession();
  const {data, error} = await supabase
    .from('game_results')
    .select('*')
    .order('played_at', {ascending: false});
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapResult);
}
