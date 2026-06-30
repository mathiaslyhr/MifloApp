import type {NavigatorScreenParams} from '@react-navigation/native';

/**
 * The app shell: a floating "island" bottom-tab bar. Home is a quick landing,
 * Games browses the registry, Menu is a hub for profile/stats/settings/FAQ.
 * Game-flow screens live on the root stack (below) so they push above the tabs
 * and the island is hidden mid-game.
 */
export type MainTabParamList = {
  Home: undefined;
  Games: undefined;
  Menu: undefined;
};

/**
 * Root navigation contract.
 *
 * `Main` is the tab shell and is game-agnostic. Quiz screens are namespaced
 * with a `Quiz` prefix so other games can add their own routes later without
 * colliding. Params are intentionally minimal for M0 and will grow as the game
 * loop is wired (M3+).
 */
export type RootStackParamList = {
  // Tab shell (Home / Games / Menu).
  Main: NavigatorScreenParams<MainTabParamList>;
  // Personal career stats / scoreboard (game-agnostic, M5), pushed from Menu.
  Stats: undefined;
  // Menu detail screens, pushed above the tabs.
  Profile: undefined;
  Settings: undefined;
  Faq: undefined;
  Feedback: undefined;

  // Shared room screens — used by every game. Join discovers the room's game
  // type from the backend; Lobby carries it so it can start the right game.
  Join: undefined;
  // Host picks topics/count on Create and carries them into the lobby; guests
  // get them from the room, so they're optional on the params.
  Lobby: {
    roomId: string;
    code: string;
    isHost: boolean;
    name: string;
    gameType: string;
    topicIds?: string[];
    count?: number;
  };

  // Football quiz (Game 1)
  QuizCreate: undefined;
  // roomId is optional so local/solo play still works without a backend.
  // isHost marks who drives the synced phase clock (M4).
  QuizQuestion: {
    roomId?: string;
    isHost?: boolean;
    code: string;
    name?: string;
    topicIds?: string[];
    count?: number;
  };
  // isHost lets the podium offer "Play again" only to the host (who drives the
  // restart); guests follow the room back into the new game.
  QuizPodium: {roomId?: string; code: string; isHost?: boolean};

  // Odd One Out (Game 2) — same room/phase model as the quiz, so the param
  // shapes mirror Quiz*. Lobby/Join are shared across games (see core/rooms).
  OddOneOutCreate: undefined;
  OddOneOutQuestion: {
    roomId?: string;
    isHost?: boolean;
    code: string;
    name?: string;
    topicIds?: string[];
    count?: number;
  };
  OddOneOutPodium: {roomId?: string; code: string; isHost?: boolean};

  // Missing XI (Game 3) — answers are typed player names; same room model.
  MissingXiCreate: undefined;
  MissingXiQuestion: {
    roomId?: string;
    isHost?: boolean;
    code: string;
    name?: string;
    topicIds?: string[];
    count?: number;
  };
  MissingXiPodium: {roomId?: string; code: string; isHost?: boolean};
};

export type RootRouteName = keyof RootStackParamList;

/** Routes that take no params — safe to `navigate(name)` without arguments. */
export type NoParamRoute = {
  [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined
    ? K
    : never;
}[keyof RootStackParamList];
