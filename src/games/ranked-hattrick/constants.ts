/**
 * Ranked Hattrick — shared constants. These MUST stay in parity with the
 * plpgsql resolver in `supabase/migrations/0034_ranked_hattrick.sql` (the
 * authority); the pure TS engine here is the reference model + client prediction.
 */

/** Each player's single match clock (2:00), shared across all boards. */
export const MATCH_CLOCK_MS = 120_000;

/**
 * Free time at the start of every turn — reading the board, tapping a square,
 * searching, typing, fixing a misspelling all cost nothing. Only time beyond
 * this burns your clock, so a staller still runs out (the opponent is never
 * stuck indefinitely).
 */
export const TURN_GRACE_MS = 15_000;

/** A match is a fixed number of boards (not first-to-N). */
export const MATCH_BOARDS = 5;

/**
 * Value (€) — the single competitive metric, Clash-Royale-trophies style but
 * denominated as a footballer market value. Win → up, loss → down, capped at
 * €250M (the best player in the world). Opponent-weighted (ELO math over the
 * value itself), shown purely in euros. All tunable.
 */
export const VALUE_START = 10_000_000; // €10M — new player
export const VALUE_FLOOR = 1_000_000; // €1M — you never drop below this
export const VALUE_CAP = 250_000_000; // €250M — the ceiling
export const VALUE_K = 5_000_000; // max even-match swing (≈ ±€2.5M at 50/50)
export const VALUE_SCALE = 40_000_000; // € gap for a ~10:1 favourite

/**
 * Anti-cheat: how many times a player may background the app mid-match before
 * the server forfeits them. 1st leave → opponent notified; 2nd → the leaver is
 * warned; MAX_BLURS-th → auto-forfeit.
 */
export const MAX_BLURS = 3;

/**
 * Abandonment: each client heartbeats while in a live match. Go silent for this
 * long (app killed, crashed, network dead) and the opponent claims the win —
 * nobody is left stranded waiting, and there's nothing to rejoin.
 */
export const HEARTBEAT_MS = 5_000;
export const ABANDON_MS = 20_000;
