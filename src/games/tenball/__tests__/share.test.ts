import {applyGuess, createInitialState, giveUp} from '../engine';
import {buildShareText} from '../share';
import type {TenballList} from '../types';

const LIST: TenballList = {
  id: 'test-list',
  entries: Array.from({length: 10}, (_, i) => ({
    rank: i + 1,
    name: `Player ${i + 1}`,
    value: `${100 - i}`,
    aliases: [`player ${i + 1}`],
  })),
};

describe('buildShareText', () => {
  it('renders a full board win with the miss count', () => {
    let state = createInitialState('2026-07-10', LIST.id);
    state = applyGuess(state, LIST, 'not him').state;
    for (let i = 1; i <= 10; i++) {
      state = applyGuess(state, LIST, `player ${i}`).state;
    }
    expect(buildShareText(state)).toBe('Top Bins 2026-07-10 · 1 miss\n🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩');
  });

  it('renders a given-up board with found count and white gaps', () => {
    let state = createInitialState('2026-07-10', LIST.id);
    state = applyGuess(state, LIST, 'player 1').state;
    state = applyGuess(state, LIST, 'player 3').state;
    state = applyGuess(state, LIST, 'wrong').state;
    state = applyGuess(state, LIST, 'also wrong').state;
    state = giveUp(state);
    expect(buildShareText(state)).toBe('Top Bins 2026-07-10 · 2/10\n🟩⬜🟩⬜⬜⬜⬜⬜⬜⬜');
  });
});
