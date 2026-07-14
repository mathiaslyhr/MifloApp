/**
 * Incoming device-transfer requests, held in a tiny Zustand store (same shape
 * as requestsStore) so a global modal can pop wherever the owner is when their
 * new phone asks to take the profile. Polled while foregrounded — the request
 * is rare and short-lived, and the query is a single indexed lookup that
 * usually returns nothing.
 */
import {AppState} from 'react-native';
import {create} from 'zustand';
import {isBackendConfigured} from '../config';
import {getCachedProfile} from '../social/socialService';
import {fetchPendingTransfer, type PendingTransfer} from './transferService';

type TransferState = {
  pending: PendingTransfer | null;
  setPending: (pending: PendingTransfer | null) => void;
  /** Ids the owner already acted on this session, so they don't re-pop. */
  handledIds: Set<string>;
  markHandled: (id: string) => void;
};

export const useTransferStore = create<TransferState>((set, get) => ({
  pending: null,
  setPending: pending => set({pending}),
  handledIds: new Set(),
  markHandled: id => {
    const next = new Set(get().handledIds);
    next.add(id);
    set({handledIds: next, pending: null});
  },
}));

async function refreshPendingTransfer(): Promise<void> {
  if (!isBackendConfigured) {
    return;
  }
  try {
    if (!(await getCachedProfile())) {
      return;
    }
    const found = await fetchPendingTransfer();
    const {pending, handledIds, setPending} = useTransferStore.getState();
    if (found && !handledIds.has(found.id)) {
      // Only publish when it actually changes, to avoid needless re-renders.
      if (pending?.id !== found.id) {
        setPending(found);
      }
    } else if (!found && pending) {
      setPending(null);
    }
  } catch {
    // Best-effort: the next tick retries.
  }
}

let watching = false;
const POLL_MS = 6000;

/**
 * App-lifetime watch: poll for an incoming request now, on every foreground, and
 * on a slow timer while active. Safe to start unconditionally from App.tsx (a
 * no-op before the device has a profile). Mirrors startRequestsRefresh.
 */
export function startTransferWatch(): void {
  if (watching || !isBackendConfigured) {
    return;
  }
  watching = true;
  refreshPendingTransfer();
  setInterval(() => {
    if (AppState.currentState === 'active') {
      refreshPendingTransfer();
    }
  }, POLL_MS);
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      refreshPendingTransfer();
    }
  });
}
