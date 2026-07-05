/**
 * Room domain types — the shape screens and game stores see, mirroring the
 * Supabase `rooms`/`players` rows but kept transport-agnostic so the backend can
 * change without touching the game (same idea as src/data/football).
 *
 * The room layer is game-agnostic: `gameType` says which game a room runs and
 * `deck` carries that game's questions in whatever shape it likes (stored as
 * jsonb server-side). Each game casts the deck back to its own type.
 */

export type RoomStatus = 'lobby' | 'in_progress' | 'finished';

/** A shared game deck — opaque to the room layer; games own its real shape. */
export type Deck = unknown[];

export type Room = {
  id: string;
  code: string;
  hostId: string;
  status: RoomStatus;
  /** Which game this room runs, e.g. 'quiz' | 'odd-one-out' | 'missing-xi'. */
  gameType: string;
  topicIds: string[];
  questionCount: number;
  /** The shared deck — null until the host starts the game. */
  questions: Deck | null;
  /**
   * Board-game state (e.g. Tic-Tac-Toe grid + board + turn), opaque to the room
   * layer; the game casts it to its own type. Null unless a board game is live.
   */
  gameState: unknown | null;
  // Phase fields exist on the row for M4's synced loop; unused in M3.
  currentIndex: number;
  phase: string | null;
  phaseDeadline: string | null;
  createdAt: string;
};

export type RoomPlayer = {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  isHost: boolean;
  score: number;
  joinedAt: string;
};
