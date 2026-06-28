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

  // Football quiz (Game 1)
  QuizCreate: undefined;
  QuizJoin: undefined;
  // Host picks topics/count on Create; guests get them from the room in M3, so
  // they're optional on the params for now.
  QuizLobby: {
    code: string;
    isHost: boolean;
    name: string;
    topicIds?: string[];
    count?: number;
  };
  QuizQuestion: {code: string; topicIds?: string[]; count?: number};
  QuizPodium: {code: string};
};

export type RootRouteName = keyof RootStackParamList;

/** Routes that take no params — safe to `navigate(name)` without arguments. */
export type NoParamRoute = {
  [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined
    ? K
    : never;
}[keyof RootStackParamList];
