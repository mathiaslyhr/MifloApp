import React from 'react';
import {Placeholder} from '../../../core/ui/Placeholder';

/**
 * Quiz flow screens. Real M1 static UI is being filled in one screen at a
 * time; the rest stay as placeholders until their turn.
 */
export {CreateGameScreen} from './CreateGameScreen';
export {JoinScreen} from './JoinScreen';
export {LobbyScreen} from './LobbyScreen';

export const QuestionScreen = () => (
  <Placeholder title="Question" note="Timer, prompt & answers — M1" />
);

export const RevealScreen = () => (
  <Placeholder title="Reveal" note="Correct answer & points — M1" />
);

export const LeaderboardScreen = () => (
  <Placeholder title="Leaderboard" note="Standings & movement — M1" />
);

export const PodiumScreen = () => (
  <Placeholder title="Podium" note="Final top 3 & play again — M1" />
);
