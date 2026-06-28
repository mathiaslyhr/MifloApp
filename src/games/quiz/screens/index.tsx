import React from 'react';
import {Placeholder} from '../../../core/ui/Placeholder';

/**
 * M0 placeholders for the quiz flow. Navigation is fully wired now; M1
 * replaces each of these with the pixel-matched static UI, then M3/M4 make
 * them live.
 */
export const CreateGameScreen = () => (
  <Placeholder title="Create game" note="Question count, topics & live count — M1" />
);

export const JoinScreen = () => (
  <Placeholder title="Join game" note="Enter code & nickname — M1" />
);

export const LobbyScreen = () => (
  <Placeholder title="Lobby" note="Game code, players & start — M1" />
);

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
