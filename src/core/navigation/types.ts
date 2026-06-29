/**
 * Root navigation contract.
 *
 * `Home` is the app-level launcher/hub and is game-agnostic. Quiz screens are
 * namespaced with a `Quiz` prefix so other games can add their own routes
 * later without colliding. Params are intentionally minimal for M0 and will
 * grow as the game loop is wired (M3+).
 */
export type RootStackParamList = {
  Home: undefined;
  // Personal career stats / scoreboard (game-agnostic, M5).
  Stats: undefined;

  // Football quiz (Game 1)
  QuizCreate: undefined;
  QuizJoin: undefined;
  // Host picks topics/count on Create and carries them into the lobby; guests
  // get them from the room, so they're optional on the params.
  QuizLobby: {
    roomId: string;
    code: string;
    isHost: boolean;
    name: string;
    topicIds?: string[];
    count?: number;
  };
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
};

export type RootRouteName = keyof RootStackParamList;

/** Routes that take no params — safe to `navigate(name)` without arguments. */
export type NoParamRoute = {
  [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined
    ? K
    : never;
}[keyof RootStackParamList];
