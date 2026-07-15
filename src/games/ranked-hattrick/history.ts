/**
 * Ranked match history — pure. The career page reads one RPC (rh_match_history,
 * migration 0041) and turns it into three things: a list of matches with an
 * opponent to name, a win/loss/draw record, and the € curve behind them.
 *
 * Everything here is pure so it can be tested without a backend; the thin
 * Supabase call lives in core/rooms/rankedService.ts, the same split value.ts
 * has with the settle RPCs.
 */

/** How a ranked match went, from the caller's side. */
export type MatchOutcome = 'win' | 'loss' | 'draw';

export type MatchOpponent = {
  userId: string;
  name: string;
  avatarPath: string | null;
};

export type RankedMatch = {
  matchId: string;
  /** ISO timestamp. */
  at: string;
  /** The € this match moved, signed. */
  delta: number;
  /** The € standing once it had. */
  valueAfter: number;
  result: MatchOutcome;
  /** Null when the opponent has since deleted their profile. */
  opponent: MatchOpponent | null;
};

export type MatchRecord = {wins: number; losses: number; draws: number};

export type MyHistory = {
  /** Newest first, the order the RPC returns. */
  matches: RankedMatch[];
  /** Counted over the whole career, not just the fetched window. */
  record: MatchRecord;
};

export const EMPTY_HISTORY: MyHistory = {
  matches: [],
  record: {wins: 0, losses: 0, draws: 0},
};

/**
 * The result of a match. Rows written from 0041 on carry it; older rows don't,
 * and are read from the sign of the delta — which is why a pre-0041 draw shows
 * as a win or a loss (its delta is signed exactly like one, so the data simply
 * cannot say). A legacy delta of 0 is a win clamped at the €250M cap; it reads
 * as a loss here to stay in parity with the record counted in rh_match_history.
 */
export function outcomeOf(
  result: string | null | undefined,
  delta: number,
): MatchOutcome {
  if (result === 'win' || result === 'loss' || result === 'draw') {
    return result;
  }
  return delta > 0 ? 'win' : 'loss';
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** One RPC row → a match, or null if it's too broken to plot. */
function matchFrom(raw: unknown): RankedMatch | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const r = raw as {[k: string]: unknown};
  const valueAfter = num(r.value_after);
  const matchId = str(r.match_id);
  const at = str(r.created_at);
  // No € standing means no point on the curve, and a match with no id can't be
  // keyed in a list. Either way it's dropped rather than rendered as a zero.
  if (valueAfter == null || matchId == null || at == null) {
    return null;
  }
  const delta = num(r.delta) ?? 0;
  const opponentId = str(r.opponent_id);
  const opponentName = str(r.opponent_name);
  return {
    matchId,
    at,
    delta,
    valueAfter,
    result: outcomeOf(str(r.result), delta),
    opponent:
      opponentId && opponentName
        ? {
            userId: opponentId,
            name: opponentName,
            avatarPath: str(r.opponent_avatar),
          }
        : null,
  };
}

/** Parse rh_match_history's jsonb. Distrusts the payload the same way the value
 * cache distrusts the disk: a half-shape should paint nothing, never a lie. */
export function historyFrom(payload: unknown): MyHistory {
  if (!payload || typeof payload !== 'object') {
    return EMPTY_HISTORY;
  }
  const p = payload as {matches?: unknown; record?: unknown};
  const matches = Array.isArray(p.matches)
    ? p.matches.map(matchFrom).filter((m): m is RankedMatch => m !== null)
    : [];
  const rec = (p.record ?? {}) as {wins?: unknown; losses?: unknown; draws?: unknown};
  return {
    matches,
    record: {
      wins: num(rec.wins) ?? 0,
      losses: num(rec.losses) ?? 0,
      draws: num(rec.draws) ?? 0,
    },
  };
}

/**
 * The € curve, oldest → newest. n matches make n + 1 points: the extra one is
 * the € held *before* the first recorded match, recovered from its own delta.
 * Without it a player's first match would be a single point — a dot, not a
 * line — and the chart would have nothing to draw.
 */
export function seriesFrom(matches: RankedMatch[]): number[] {
  if (matches.length === 0) {
    return [];
  }
  const oldestFirst = [...matches].reverse();
  const origin = oldestFirst[0].valueAfter - oldestFirst[0].delta;
  return [origin, ...oldestFirst.map(m => m.valueAfter)];
}

/** How much air to leave above and below the curve. */
const PAD = 0.08;

/**
 * The chart's y range: the data's own min/max plus a margin — deliberately NOT
 * 0 → VALUE_CAP. Anchoring to the €250M cap is what makes a real €10M account
 * read as a flat 4% line; a career is only legible against the € it actually
 * lived in.
 */
export function domainFor(series: number[]): {min: number; max: number} {
  if (series.length === 0) {
    return {min: 0, max: 1};
  }
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const span = hi - lo;
  // A flat run (or one point) has no span to take a percentage of, so fall back
  // to a share of the value itself — and never zero, which would divide by 0
  // when the chart scales a point.
  const pad = span > 0 ? span * PAD : Math.max(Math.abs(hi) * PAD, 1);
  return {min: lo - pad, max: hi + pad};
}
