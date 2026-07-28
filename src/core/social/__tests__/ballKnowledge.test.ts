/**
 * @format
 */
import {
  formatBk,
  mapBkBoard,
  mapBkDuel,
  monthKeyFor,
  previousMonthKey,
} from '../ballKnowledgeService';

describe('monthKeyFor', () => {
  it('pads single-digit months', () => {
    expect(monthKeyFor(new Date(2026, 0, 15))).toBe('2026-01');
  });

  it('keeps double-digit months', () => {
    expect(monthKeyFor(new Date(2026, 11, 3))).toBe('2026-12');
  });
});

describe('previousMonthKey', () => {
  it('steps back one month', () => {
    expect(previousMonthKey('2026-07')).toBe('2026-06');
  });

  it('rolls the year over at January', () => {
    expect(previousMonthKey('2026-01')).toBe('2025-12');
  });
});

describe('mapBkBoard', () => {
  it('maps a full snake_case payload', () => {
    expect(
      mapBkBoard({
        rows: [
          {rank: 1, group_id: 'barcelona', bk: 71.4, members: 5, is_mine: true},
          {rank: 2, group_id: 'real-madrid', bk: 68.9, members: 7, is_mine: false},
        ],
        me: {
          group_id: 'barcelona',
          rank: 1,
          group_bk: 71.4,
          group_members: 5,
          my_bk: 80,
          my_played: 12,
          counted: true,
        },
        previous_winner: {
          month_key: '2026-06',
          group_id: 'real-madrid',
          bk: 74.2,
          members: 6,
        },
      }),
    ).toEqual({
      rows: [
        {rank: 1, groupId: 'barcelona', bk: 71.4, members: 5, isMine: true},
        {rank: 2, groupId: 'real-madrid', bk: 68.9, members: 7, isMine: false},
      ],
      me: {
        groupId: 'barcelona',
        rank: 1,
        groupBk: 71.4,
        groupMembers: 5,
        myBk: 80,
        myPlayed: 12,
        counted: true,
      },
      previousWinner: {
        monthKey: '2026-06',
        groupId: 'real-madrid',
        bk: 74.2,
        members: 6,
      },
    });
  });

  it('passes empty rows and null me/previous_winner through', () => {
    expect(mapBkBoard({rows: [], me: null, previous_winner: null})).toEqual({
      rows: [],
      me: null,
      previousWinner: null,
    });
  });

  it('keeps a null rank inside me (group below the floor)', () => {
    const board = mapBkBoard({
      rows: [],
      me: {
        group_id: 'sc-bastia',
        rank: null,
        group_bk: 55,
        group_members: 1,
        my_bk: 55,
        my_played: 4,
        counted: true,
      },
      previous_winner: null,
    });
    expect(board.me).toEqual({
      groupId: 'sc-bastia',
      rank: null,
      groupBk: 55,
      groupMembers: 1,
      myBk: 55,
      myPlayed: 4,
      counted: true,
    });
  });

  it('survives a malformed payload as an empty board', () => {
    expect(mapBkBoard(undefined)).toEqual({rows: [], me: null, previousWinner: null});
  });
});

describe('mapBkDuel', () => {
  const wireSide = {
    group_id: 'denmark',
    bk: 62.5,
    members: 3,
    rights: 90,
    wrongs: 54,
  };
  const side = {groupId: 'denmark', bk: 62.5, members: 3, rights: 90, wrongs: 54};

  it('maps both sides', () => {
    expect(
      mapBkDuel({a: wireSide, b: {...wireSide, group_id: 'sweden'}}),
    ).toEqual({a: side, b: {...side, groupId: 'sweden'}});
  });

  it('keeps one empty side null', () => {
    expect(mapBkDuel({a: wireSide, b: null})).toEqual({a: side, b: null});
  });

  it('keeps both sides null', () => {
    expect(mapBkDuel({a: null, b: null})).toEqual({a: null, b: null});
  });
});

describe('formatBk', () => {
  it('keeps one decimal when it carries information', () => {
    expect(formatBk(87.5)).toBe('87.5');
  });

  it('drops a trailing zero decimal', () => {
    expect(formatBk(100)).toBe('100');
    expect(formatBk(62.0)).toBe('62');
  });
});
