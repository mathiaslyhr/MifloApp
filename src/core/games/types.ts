import type {NoParamRoute} from '../navigation/types';

/**
 * A game manifest is how a game advertises itself to the Home hub. The hub
 * renders a tile per registered game and routes to its entry screen — it has
 * no knowledge of any specific game. Adding a second game is just another
 * manifest in the registry.
 */
export type GameManifest = {
  /** Stable id, e.g. "quiz". */
  id: string;
  /** Display title shown on the hub tile. */
  title: string;
  /** Short one-line description. */
  subtitle: string;
  /** Route the tile navigates to (its create/entry screen, no params). */
  entryRoute: NoParamRoute;
  /** Whether the game is playable yet (greys out "coming soon" tiles). */
  available: boolean;
};
