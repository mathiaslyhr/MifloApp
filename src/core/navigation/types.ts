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
  QuizLobby: {code: string; isHost: boolean};
  QuizQuestion: {code: string};
  QuizReveal: {code: string};
  QuizLeaderboard: {code: string};
  QuizPodium: {code: string};
};

export type RootRouteName = keyof RootStackParamList;

/** Routes that take no params — safe to `navigate(name)` without arguments. */
export type NoParamRoute = {
  [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined
    ? K
    : never;
}[keyof RootStackParamList];
