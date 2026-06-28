/**
 * Room domain types — the shape screens and the quiz store see, mirroring the
 * Supabase `rooms`/`players` rows but kept transport-agnostic so the backend can
 * change without touching the game (same idea as src/data/football).
 */
import type {Question} from '../../games/quiz/mockData';

export type RoomStatus = 'lobby' | 'in_progress' | 'finished';

export type Room = {
  id: string;
  code: string;
  hostId: string;
  status: RoomStatus;
  topicIds: string[];
  questionCount: number;
  /** The shared deck — null until the host starts the game. */
  questions: Question[] | null;
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
