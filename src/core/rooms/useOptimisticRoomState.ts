/**
 * Room game state with optimistic local moves. Realtime echoes from the
 * server remain the source of truth; the player's own move just paints
 * immediately instead of waiting a full RPC + Realtime round-trip.
 *
 * Rules:
 *  - `applyServer` records AND shows the authoritative state (echoes of our
 *    own move, other players' moves, host actions).
 *  - `applyOptimistic` shows `next` right away and fires the RPC. If the RPC
 *    rejects, the view falls back to the latest server state (which may be
 *    newer than the one we started from) and the error is rethrown so the
 *    caller's toast/haptic handling still runs.
 */
import {useCallback, useRef, useState} from 'react';

export function useOptimisticRoomState<T>() {
  const [state, setState] = useState<T | null>(null);
  const serverState = useRef<T | null>(null);

  const applyServer = useCallback((next: T | null) => {
    serverState.current = next;
    setState(next);
  }, []);

  const applyOptimistic = useCallback(
    async (next: T, rpc: () => Promise<unknown>): Promise<void> => {
      setState(next);
      try {
        await rpc();
      } catch (error) {
        setState(serverState.current);
        throw error;
      }
    },
    [],
  );

  return {state, applyServer, applyOptimistic};
}
