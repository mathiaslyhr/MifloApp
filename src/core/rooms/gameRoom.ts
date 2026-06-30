/**
 * Per-game room behaviour, registered by each game so the shared Lobby/Join
 * screens can run any game without importing it. The room layer stays
 * game-agnostic: it knows a room's `gameType` and looks the rest up here.
 *
 * Games self-register at module load via `registerGameRoom` (see each game's
 * `room.ts`). The dependency arrow points games → core, never the reverse.
 */
import type {Deck, RoomPlayer} from './types';

/** Setup carried from a game's Create screen into the lobby. */
export type LobbyConfig = {
  topicIds?: string[];
  count?: number;
};

/** The in-game screen each game's lobby hands off to once the deck is ready. */
export type QuestionRoute =
  | 'QuizQuestion'
  | 'OddOneOutQuestion'
  | 'MissingXiQuestion';

export type GameRoomConfig = {
  /** Matches Room.gameType and the manifest id, e.g. 'quiz'. */
  gameType: string;
  /** Route the lobby navigates to when the game starts. */
  questionRoute: QuestionRoute;
  /** Length of the first phase, for the host's initial synced deadline. */
  firstPhaseDurationMs: number;
  /** Host-only: build the shared deck broadcast to every device. */
  buildDeck: (config: LobbyConfig) => Deck;
  /**
   * Hydrate this game's store from the room deck + roster. Runs on both host
   * and guest before navigating into the game.
   */
  hydrate: (deck: Deck, roster: readonly RoomPlayer[], myUserId: string | null) => void;
  /** Optional lobby subtitle, e.g. "10 questions · 3 topics". */
  lobbySubtitle?: (config: LobbyConfig) => string;
};

const registry = new Map<string, GameRoomConfig>();

/** Register a game's room behaviour. Called once per game at module load. */
export function registerGameRoom(config: GameRoomConfig): void {
  registry.set(config.gameType, config);
}

/** Look up a game's room behaviour; throws if the game didn't register. */
export function getGameRoom(gameType: string): GameRoomConfig {
  const config = registry.get(gameType);
  if (!config) {
    throw new Error(`No room config registered for game "${gameType}"`);
  }
  return config;
}
