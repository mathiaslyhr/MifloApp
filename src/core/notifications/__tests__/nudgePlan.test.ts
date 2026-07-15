/**
 * The nudge planner decides a day's notifications from state alone: no notifee,
 * no storage, no i18n. Two rules carry the whole design.
 *
 * Local notifications cannot be conditional at delivery, so only TODAY may be
 * planned from state. Days 1..13 of the window are scheduled blind and must
 * therefore always be content-free curiosity copy.
 *
 * The max-two-a-day cap is structural rather than a check: at most one window
 * trigger can land on today, and the evening slot holds exactly one message.
 */
import {
  planNudges,
  slotMinutesFor,
  CURIOSITY_VARIANTS,
  DEFAULT_SLOT_MINUTES,
  type NudgePlan,
} from '../nudgePlan';
import {dateKeyFor} from '../../../games/scout/dailySeed';

const BASE = {
  allFinishedToday: false,
  atRiskDays: [] as number[],
  startedUnfinished: [] as never[],
};

/** Everything the plan would deliver on the calendar day containing `nowMs`. */
function todaysNudges(plan: NudgePlan, nowMs: number) {
  const todayKey = dateKeyFor(new Date(nowMs));
  const onToday = [...plan.window, ...(plan.evening ? [plan.evening] : [])];
  return onToday.filter(n => dateKeyFor(new Date(n.at)) === todayKey);
}

describe('slotMinutesFor', () => {
  test('first run, with no anchor yet, keeps the 09:00 the app ships today', () => {
    expect(slotMinutesFor(null)).toBe(9 * 60);
    expect(DEFAULT_SLOT_MINUTES).toBe(9 * 60);
  });

  test('pings 30 minutes before the habit', () => {
    expect(slotMinutesFor(17 * 60)).toBe(16 * 60 + 30);
  });

  test('clamps up to the 09:00 floor', () => {
    // 09:10 habit would ping at 08:40, which is before the floor.
    expect(slotMinutesFor(9 * 60 + 10)).toBe(9 * 60);
    expect(slotMinutesFor(3 * 60)).toBe(9 * 60);
  });

  test('clamps down to the 22:00 cap', () => {
    expect(slotMinutesFor(23 * 60)).toBe(22 * 60);
    // 22:40 habit would ping at 22:10, past the cap.
    expect(slotMinutesFor(22 * 60 + 40)).toBe(22 * 60);
  });

  test('leaves a late habit alone while the lead still fits under the cap', () => {
    expect(slotMinutesFor(22 * 60 + 25)).toBe(21 * 60 + 55);
  });

  test('the cap wins over a habit past midnight rather than wrapping', () => {
    expect(slotMinutesFor(10)).toBe(9 * 60);
  });
});

describe('the window', () => {
  const now = new Date(2026, 6, 10, 8, 0).getTime();

  test('is 14 one-shots at the slot on 14 consecutive days', () => {
    const {window} = planNudges({...BASE, nowMs: now, slotMinutes: 16 * 60 + 30});

    expect(window.map(n => n.at)).toEqual(
      Array.from({length: 14}, (_, day) =>
        new Date(2026, 6, 10 + day, 16, 30).getTime(),
      ),
    );
  });

  test('uses stable ids so re-syncing upserts instead of stacking', () => {
    const {window} = planNudges({...BASE, nowMs: now, slotMinutes: 9 * 60});

    expect(window.map(n => n.id)).toEqual(
      Array.from({length: 14}, (_, day) => `scout-daily-${day}`),
    );
  });

  test('starts tomorrow once the slot has passed', () => {
    const afterSlot = new Date(2026, 6, 10, 14, 0).getTime();

    const {window} = planNudges({...BASE, nowMs: afterSlot, slotMinutes: 9 * 60});

    expect(window[0].at).toBe(new Date(2026, 6, 11, 9, 0).getTime());
  });

  test('starts tomorrow when every daily is already done', () => {
    const {window} = planNudges({
      ...BASE,
      nowMs: now,
      slotMinutes: 9 * 60,
      allFinishedToday: true,
    });

    expect(window[0].at).toBe(new Date(2026, 6, 11, 9, 0).getTime());
  });
});

describe('curiosity rotation', () => {
  const now = new Date(2026, 6, 10, 8, 0).getTime();

  test('varies across the window instead of repeating one sentence', () => {
    const {window} = planNudges({...BASE, nowMs: now, slotMinutes: 9 * 60});

    const bodies = window.map(n => n.bodyKey);
    expect(new Set(bodies).size).toBeGreaterThan(1);
    for (const body of bodies) {
      expect(body).toMatch(
        new RegExp(`^scout\\.curiosityNotifBody_[0-${CURIOSITY_VARIANTS - 1}]$`),
      );
    }
  });

  // The window re-anchors on every launch, so rotating by position in the
  // window would pin a daily-active user to variant 0 forever. Rotating by
  // calendar date is what makes the variety real.
  test('is fixed to the calendar date, not the position in the window', () => {
    const today = planNudges({...BASE, nowMs: now, slotMinutes: 9 * 60});
    const tomorrow = planNudges({
      ...BASE,
      nowMs: new Date(2026, 6, 11, 8, 0).getTime(),
      slotMinutes: 9 * 60,
    });

    // 2026-07-11 is day 1 of today's window and day 0 of tomorrow's.
    expect(tomorrow.window[0].bodyKey).toBe(today.window[1].bodyKey);
  });
});

describe('a streak at risk', () => {
  const now = new Date(2026, 6, 10, 8, 0).getTime();

  test("takes over today's nudge, leading with the number", () => {
    const {window} = planNudges({
      ...BASE,
      nowMs: now,
      slotMinutes: 9 * 60,
      atRiskDays: [47],
    });

    expect(window[0]).toMatchObject({
      bodyKey: 'scout.streakNotifBody',
      params: {days: 47},
    });
  });

  test('coalesces into a count when several are live', () => {
    const {window} = planNudges({
      ...BASE,
      nowMs: now,
      slotMinutes: 9 * 60,
      atRiskDays: [5, 12, 2],
    });

    expect(window[0]).toMatchObject({
      bodyKey: 'scout.streaksNotifBody',
      params: {count: 3},
    });
  });

  // Day+3's streak is unknowable at scheduling time.
  test('never leaks into the rest of the window', () => {
    const {window} = planNudges({
      ...BASE,
      nowMs: now,
      slotMinutes: 9 * 60,
      atRiskDays: [47],
    });

    for (const nudge of window.slice(1)) {
      expect(nudge.bodyKey).toMatch(/^scout\.curiosityNotifBody_/);
    }
  });

  test('adds a 20:00 last call', () => {
    const {evening} = planNudges({
      ...BASE,
      nowMs: now,
      slotMinutes: 9 * 60,
      atRiskDays: [47],
    });

    expect(evening).toMatchObject({
      id: 'streak-saver',
      bodyKey: 'scout.streakLastCallBody',
      params: {days: 47},
      at: new Date(2026, 6, 10, 20, 0).getTime(),
    });
  });

  test('has no last call once 20:00 has passed', () => {
    const {evening} = planNudges({
      ...BASE,
      nowMs: new Date(2026, 6, 10, 21, 0).getTime(),
      slotMinutes: 9 * 60,
      atRiskDays: [47],
    });

    expect(evening).toBeNull();
  });
});

describe('the evening taunt', () => {
  const now = new Date(2026, 6, 10, 10, 0).getTime();

  test('fires for a puzzle that was started and abandoned', () => {
    const {evening} = planNudges({
      ...BASE,
      nowMs: now,
      slotMinutes: 9 * 60,
      startedUnfinished: ['scout'],
    });

    expect(evening).toMatchObject({
      id: 'streak-saver',
      bodyKey: 'scout.unfinishedNotifBody',
      params: {game: 'scout'},
      at: new Date(2026, 6, 10, 20, 0).getTime(),
    });
  });

  test('counts them instead of naming when several were abandoned', () => {
    const {evening} = planNudges({
      ...BASE,
      nowMs: now,
      slotMinutes: 9 * 60,
      startedUnfinished: ['scout', 'tenball'],
    });

    expect(evening).toMatchObject({
      bodyKey: 'scout.unfinishedManyNotifBody',
      params: {count: 2},
    });
  });

  // "Was it that hard?" is a bluff against someone who never opened it.
  test('stays silent for a day nobody touched', () => {
    const {evening} = planNudges({...BASE, nowMs: now, slotMinutes: 9 * 60});

    expect(evening).toBeNull();
  });

  test('yields to a streak, which is the more urgent message', () => {
    const {evening} = planNudges({
      ...BASE,
      nowMs: now,
      slotMinutes: 9 * 60,
      atRiskDays: [47],
      startedUnfinished: ['scout'],
    });

    expect(evening!.bodyKey).toBe('scout.streakLastCallBody');
  });
});

describe('never more than two a day', () => {
  const cases: {name: string; input: Parameters<typeof planNudges>[0]}[] = [];
  for (const atRiskDays of [[], [47], [5, 12]]) {
    for (const startedUnfinished of [[], ['scout' as const]]) {
      for (const slotMinutes of [9 * 60, 14 * 60, 21 * 60, 22 * 60]) {
        for (const hour of [8, 10, 21]) {
          for (const allFinishedToday of [false, true]) {
            cases.push({
              name: `risk=${atRiskDays.length} started=${startedUnfinished.length} slot=${slotMinutes} hour=${hour} done=${allFinishedToday}`,
              input: {
                nowMs: new Date(2026, 6, 10, hour, 0).getTime(),
                slotMinutes,
                allFinishedToday,
                atRiskDays,
                startedUnfinished,
              },
            });
          }
        }
      }
    }
  }

  test.each(cases)('$name', ({input}) => {
    const today = todaysNudges(planNudges(input), input.nowMs);
    expect(today.length).toBeLessThanOrEqual(2);
  });

  test('is exactly one when nothing is at stake', () => {
    const nowMs = new Date(2026, 6, 10, 8, 0).getTime();

    const today = todaysNudges(
      planNudges({...BASE, nowMs, slotMinutes: 9 * 60}),
      nowMs,
    );

    expect(today).toHaveLength(1);
    expect(today[0].bodyKey).toMatch(/^scout\.curiosityNotifBody_/);
  });

  test('is exactly two only when a streak is live and the slot is ahead', () => {
    const nowMs = new Date(2026, 6, 10, 8, 0).getTime();

    const today = todaysNudges(
      planNudges({...BASE, nowMs, slotMinutes: 9 * 60, atRiskDays: [47]}),
      nowMs,
    );

    expect(today.map(n => n.bodyKey)).toEqual([
      'scout.streakNotifBody',
      'scout.streakLastCallBody',
    ]);
  });
});

describe('a late habit slot', () => {
  // "Last call" at 20:00 followed by "on the line" at 22:00 reads backwards.
  test('yields to the 20:00 evening rather than stacking behind it', () => {
    const nowMs = new Date(2026, 6, 10, 8, 0).getTime();

    const plan = planNudges({
      ...BASE,
      nowMs,
      slotMinutes: 22 * 60,
      atRiskDays: [47],
    });

    expect(todaysNudges(plan, nowMs)).toHaveLength(1);
    expect(plan.evening!.bodyKey).toBe('scout.streakLastCallBody');
    expect(plan.window[0].at).toBe(new Date(2026, 6, 11, 22, 0).getTime());
  });

  // ...but with 20:00 gone, the late slot is the streak's last chance.
  test('is kept when 20:00 has already passed', () => {
    const nowMs = new Date(2026, 6, 10, 21, 0).getTime();

    const plan = planNudges({
      ...BASE,
      nowMs,
      slotMinutes: 22 * 60,
      atRiskDays: [47],
    });

    expect(plan.evening).toBeNull();
    expect(todaysNudges(plan, nowMs)).toHaveLength(1);
    expect(plan.window[0]).toMatchObject({
      bodyKey: 'scout.streakNotifBody',
      at: new Date(2026, 6, 10, 22, 0).getTime(),
    });
  });
});
