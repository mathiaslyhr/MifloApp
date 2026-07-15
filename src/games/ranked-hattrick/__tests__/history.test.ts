import {domainFor, historyFrom, outcomeOf, seriesFrom} from '../history';
import type {RankedMatch} from '../history';

/** A match, with only the fields a test cares about spelled out. */
function match(over: Partial<RankedMatch> = {}): RankedMatch {
  return {
    matchId: 'm1',
    at: '2026-07-15T10:00:00Z',
    delta: 1_000_000,
    valueAfter: 11_000_000,
    result: 'win',
    opponent: {userId: 'u2', name: 'Jonas', avatarPath: null},
    ...over,
  };
}

describe('outcomeOf — the legacy fallback', () => {
  it('trusts an explicit result over the delta', () => {
    // A draw is the whole reason the column exists: its delta is signed like a
    // win or a loss, so only the stored result can tell the truth.
    expect(outcomeOf('draw', 400_000)).toBe('draw');
    expect(outcomeOf('draw', -400_000)).toBe('draw');
    expect(outcomeOf('loss', 500_000)).toBe('loss');
  });

  it('reads a pre-0041 row from the sign of the delta', () => {
    expect(outcomeOf(null, 2_500_000)).toBe('win');
    expect(outcomeOf(null, -2_500_000)).toBe('loss');
  });

  it('calls a legacy no-op a loss, matching the SQL', () => {
    // delta 0 = a clamped win at the €250M cap. Rare, legacy-only, and the
    // record RPC counts it the same way — parity matters more than the guess.
    expect(outcomeOf(null, 0)).toBe('loss');
  });

  it('ignores a result it does not recognise', () => {
    expect(outcomeOf('banana', 900_000)).toBe('win');
  });
});

describe('historyFrom — parsing the RPC', () => {
  const payload = {
    matches: [
      {
        match_id: 'm2',
        created_at: '2026-07-15T12:00:00Z',
        delta: -2_000_000,
        value_after: 9_000_000,
        result: 'loss',
        opponent_id: 'u3',
        opponent_name: 'Sofie',
        opponent_avatar: 'avatars/u3.jpg',
      },
    ],
    record: {wins: 4, losses: 2, draws: 1},
  };

  it('maps a row into a match', () => {
    const {matches} = historyFrom(payload);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({
      matchId: 'm2',
      at: '2026-07-15T12:00:00Z',
      delta: -2_000_000,
      valueAfter: 9_000_000,
      result: 'loss',
      opponent: {userId: 'u3', name: 'Sofie', avatarPath: 'avatars/u3.jpg'},
    });
  });

  it('keeps a match whose opponent has deleted their profile', () => {
    const orphan = {
      ...payload,
      matches: [{...payload.matches[0], opponent_id: null, opponent_name: null}],
    };
    const {matches} = historyFrom(orphan);
    expect(matches).toHaveLength(1);
    expect(matches[0].opponent).toBeNull();
  });

  it('reads the record', () => {
    expect(historyFrom(payload).record).toEqual({wins: 4, losses: 2, draws: 1});
  });

  it('survives junk rather than painting a broken card', () => {
    const empty = {matches: [], record: {wins: 0, losses: 0, draws: 0}};
    expect(historyFrom(null)).toEqual(empty);
    expect(historyFrom({})).toEqual(empty);
    expect(historyFrom({matches: 'nope'})).toEqual(empty);
    // A row with no € standing can't be plotted, so it isn't kept.
    expect(historyFrom({matches: [{match_id: 'x'}]}).matches).toEqual([]);
  });
});

describe('seriesFrom — the chart points', () => {
  it('has no points without a match', () => {
    expect(seriesFrom([])).toEqual([]);
  });

  it('turns one match into a line, not a dot', () => {
    // The synthetic origin is the € the player held *before* their first
    // recorded match: value_after minus the delta that produced it.
    const s = seriesFrom([match({delta: 1_000_000, valueAfter: 11_000_000})]);
    expect(s).toEqual([10_000_000, 11_000_000]);
  });

  it('reverses the RPC into time order and keeps n + 1 points', () => {
    // The RPC hands back newest-first; the chart reads left → right.
    const newestFirst = [
      match({matchId: 'c', valueAfter: 13_000_000, delta: 1_000_000}),
      match({matchId: 'b', valueAfter: 12_000_000, delta: 2_000_000}),
      match({matchId: 'a', valueAfter: 10_000_000, delta: -1_000_000}),
    ];
    expect(seriesFrom(newestFirst)).toEqual([
      11_000_000, // origin: 10M − (−1M)
      10_000_000,
      12_000_000,
      13_000_000,
    ]);
  });
});

describe('domainFor — the y range', () => {
  it('pads the data it was given, and never anchors to the cap', () => {
    const {min, max} = domainFor([10_000_000, 20_000_000]);
    expect(min).toBeLessThan(10_000_000);
    expect(max).toBeGreaterThan(20_000_000);
    // The point of the whole exercise: €20M must not read as 8% of €250M.
    expect(max).toBeLessThan(30_000_000);
  });

  it('gives a flat line room to breathe instead of dividing by zero', () => {
    const {min, max} = domainFor([10_000_000, 10_000_000]);
    expect(max - min).toBeGreaterThan(0);
  });

  it('handles a single point', () => {
    const {min, max} = domainFor([10_000_000]);
    expect(max - min).toBeGreaterThan(0);
  });

  it('is empty-safe', () => {
    const {min, max} = domainFor([]);
    expect(max).toBeGreaterThan(min);
  });
});
