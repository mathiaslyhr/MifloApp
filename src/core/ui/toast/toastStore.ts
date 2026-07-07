/**
 * Toast store — the app's transient, non-blocking messaging (replaces most
 * `Alert.alert` calls used for confirmations/errors that don't need a button).
 *
 * A tiny Zustand store so a toast can be fired imperatively from anywhere —
 * event handlers, async catches, services — not just React components. The
 * `<ToastHost/>` mounted at the app root subscribes and renders the stack.
 */
import {create} from 'zustand';

export type ToastTone = 'neutral' | 'success' | 'error';

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
  /** Auto-dismiss delay in ms. */
  duration: number;
};

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastState = {
  toasts: Toast[];
  show: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const DEFAULT_DURATION = 2600;
/** Cap the stack so a burst of messages can't cover the screen. */
const MAX_TOASTS = 3;

let seq = 0;

export const useToastStore = create<ToastState>(set => ({
  toasts: [],
  show: ({message, tone = 'neutral', duration = DEFAULT_DURATION}) => {
    const id = `toast-${++seq}`;
    set(state => ({
      toasts: [...state.toasts, {id, message, tone, duration}].slice(-MAX_TOASTS),
    }));
    return id;
  },
  dismiss: id =>
    set(state => ({toasts: state.toasts.filter(t => t.id !== id)})),
}));

/**
 * Imperative façade for firing toasts outside React. `toast.success('Saved')`
 * reads clearest at call sites; `toast.show({...})` covers the general case.
 */
export const toast = {
  show: (opts: ToastOptions) => useToastStore.getState().show(opts),
  neutral: (message: string) =>
    useToastStore.getState().show({message, tone: 'neutral'}),
  success: (message: string) =>
    useToastStore.getState().show({message, tone: 'success'}),
  error: (message: string) =>
    useToastStore.getState().show({message, tone: 'error'}),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

/** Hook for components that want to fire a toast within the tree. */
export function useToast() {
  return toast;
}
