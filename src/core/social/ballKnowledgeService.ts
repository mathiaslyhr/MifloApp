/**
 * Ball Knowledge client wrappers — the fan-group competition RPCs from
 * migration 0049. Favorites (0029) say who you support, daily_results says how
 * you play; the server joins them into one number per fan base. Mirrors
 * rankedService's shape (requireClient + supabase.rpc + pure mappers the tests
 * can hit without a client).
 *
 * The metric in one sentence: Ball Knowledge is the share of your answers that
 * are right, 0..100, across the dailies you actually played. The server owns
 * the math; this file only speaks the wire shape.
 */
import {ensureSession, supabase} from '../supabase/client';
import {BackendUnavailableError} from '../rooms/roomService';

export type BkDimension = 'club' | 'nation';

export type BkGroupRow = {
  rank: number;
  groupId: string;
  bk: number;
  members: number;
  isMine: boolean;
};

export type BkMe = {
  groupId: string;
  /** Null while the group is below the board's member floor. */
  rank: number | null;
  groupBk: number | null;
  groupMembers: number;
  /** Null until the caller has recorded at least one answer this month. */
  myBk: number | null;
  myPlayed: number;
  /** Whether the caller has met the member floor and counts for their group. */
  counted: boolean;
};

export type BkWinner = {
  monthKey: string;
  groupId: string;
  bk: number;
  members: number;
};

export type BkBoard = {
  rows: BkGroupRow[];
  me: BkMe | null;
  previousWinner: BkWinner | null;
};

export type BkDuelSide = {
  groupId: string;
  bk: number;
  members: number;
  rights: number;
  wrongs: number;
};

export type BkDuel = {
  a: BkDuelSide | null;
  b: BkDuelSide | null;
};

/**
 * Mirror of the SQL member floor in 0049, for copy interpolation only ("play 3
 * dailies to count"). The server owns the real gate.
 */
export const BK_MIN_PLAYED = 3;

/** Mirror of the SQL group floor in 0049 — copy interpolation only, again. */
export const BK_MIN_MEMBERS = 2;

/** 'YYYY-MM' in local time — the month-granular sibling of dateKeyFor. */
export function monthKeyFor(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

/** '2026-01' -> '2025-12'. */
export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : monthKeyFor(new Date(year, month - 2, 1));
}

/** A BK number for display: one decimal when it says something, none when .0. */
export function formatBk(bk: number): string {
  const rounded = Math.round(bk * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function rowFrom(row: any): BkGroupRow {
  return {
    rank: row.rank ?? 0,
    groupId: row.group_id ?? '',
    bk: row.bk ?? 0,
    members: row.members ?? 0,
    isMine: row.is_mine ?? false,
  };
}

export function mapBkBoard(data: unknown): BkBoard {
  const payload = (data ?? {}) as {rows?: any[]; me?: any; previous_winner?: any};
  return {
    rows: (payload.rows ?? []).map(rowFrom),
    me: payload.me
      ? {
          groupId: payload.me.group_id ?? '',
          rank: payload.me.rank ?? null,
          groupBk: payload.me.group_bk ?? null,
          groupMembers: payload.me.group_members ?? 0,
          myBk: payload.me.my_bk ?? null,
          myPlayed: payload.me.my_played ?? 0,
          counted: payload.me.counted ?? false,
        }
      : null,
    previousWinner: payload.previous_winner
      ? {
          monthKey: payload.previous_winner.month_key ?? '',
          groupId: payload.previous_winner.group_id ?? '',
          bk: payload.previous_winner.bk ?? 0,
          members: payload.previous_winner.members ?? 0,
        }
      : null,
  };
}

function sideFrom(side: any): BkDuelSide | null {
  if (!side) {
    return null;
  }
  return {
    groupId: side.group_id ?? '',
    bk: side.bk ?? 0,
    members: side.members ?? 0,
    rights: side.rights ?? 0,
    wrongs: side.wrongs ?? 0,
  };
}

export function mapBkDuel(data: unknown): BkDuel {
  const payload = (data ?? {}) as {a?: any; b?: any};
  return {a: sideFrom(payload.a), b: sideFrom(payload.b)};
}

async function requireClient() {
  if (!supabase) {
    throw new BackendUnavailableError();
  }
  await ensureSession();
  return supabase;
}

/** The month's board: every fan group over the floor, ranked, plus my place. */
export async function fetchBallKnowledgeBoard(
  dimension: BkDimension,
  monthKey: string,
): Promise<BkBoard> {
  const client = await requireClient();
  const {data, error} = await client.rpc('ball_knowledge_board', {
    p_dimension: dimension,
    p_month_key: monthKey,
  });
  if (error) {
    throw error;
  }
  return mapBkBoard(data);
}

/** Two fan groups head to head over one month. A null side has no counted fans. */
export async function fetchBallKnowledgeDuel(
  dimension: BkDimension,
  sideA: string,
  sideB: string,
  monthKey: string,
): Promise<BkDuel> {
  const client = await requireClient();
  const {data, error} = await client.rpc('ball_knowledge_duel', {
    p_dimension: dimension,
    p_side_a: sideA,
    p_side_b: sideB,
    p_month_key: monthKey,
  });
  if (error) {
    throw error;
  }
  return mapBkDuel(data);
}
