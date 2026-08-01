/**
 * Guided-tour store — the first-launch walkthrough's state (whether it's
 * running and which step it's on) plus a registry of spotlight targets.
 *
 * A tiny Zustand store, like the toast store, so the tour can be started
 * imperatively from anywhere (the profile gate in App.tsx, the replay row in
 * How to play). The `<TourOverlay/>` mounted at the app root subscribes and
 * renders the walkthrough; all side effects (persisting "seen", switching
 * tabs) live there, keeping this store pure and unit-testable.
 *
 * Targets register a ref, not a rect: the overlay measures lazily when a step
 * needs the element, so rects are never stale after scrolls or tab switches.
 */
import type {RefObject} from 'react';
import type {View} from 'react-native';
import {create} from 'zustand';
import type {TabId} from '../IslandTabBar';

export type TourTargetId =
  | 'homeDailyCard'
  | 'homeMatchButtons'
  | 'tabDaily'
  | 'tabPlay'
  | 'tabProfile';

export type TourStep = {
  /** i18n suffix: copy lives at `tour.steps.<key>.{title,body}`. */
  key: string;
  /** Element to spotlight; null renders a centered card with no cutout. */
  target: TourTargetId | null;
  /** Tab that must be active for this step (the overlay switches to it). */
  tab: TabId;
  /** Corner shape of the spotlight ring; tab items sit in the nav pill. */
  ring: 'card' | 'pill';
};

/**
 * The walkthrough: what the app IS (dailies vs matches), then where things
 * live (one step per unfamiliar tab, switching to it for real so the page is
 * visible behind the card), then a send-off into the first daily. The tour
 * teaches the map, not the rules — every game keeps its own "?" modal.
 */
export const TOUR_STEPS: TourStep[] = [
  {key: 'welcome', target: null, tab: 'home', ring: 'card'},
  {key: 'dailies', target: 'homeDailyCard', tab: 'home', ring: 'card'},
  {key: 'matches', target: 'homeMatchButtons', tab: 'home', ring: 'card'},
  {key: 'tabDaily', target: 'tabDaily', tab: 'daily', ring: 'pill'},
  {key: 'tabPlay', target: 'tabPlay', tab: 'play', ring: 'pill'},
  {key: 'tabProfile', target: 'tabProfile', tab: 'profile', ring: 'pill'},
  {key: 'finish', target: null, tab: 'home', ring: 'card'},
];

type TourState = {
  active: boolean;
  step: number;
  start: () => void;
  next: () => void;
  /** Ends the tour (both "finished" and "skipped" land here). */
  stop: () => void;
};

export const useTourStore = create<TourState>(set => ({
  active: false,
  step: 0,
  start: () => set({active: true, step: 0}),
  next: () =>
    set(state =>
      state.step + 1 < TOUR_STEPS.length
        ? {step: state.step + 1}
        : {active: false},
    ),
  stop: () => set({active: false}),
}));

/** Imperative façade for starting outside React (App.tsx gate, replay row). */
export function startTour(): void {
  useTourStore.getState().start();
}

// ---------------------------------------------------------------------------
// Target registry — refs live outside the store (they're not renderable
// state), keyed by id. TourTarget registers on mount, unregisters on unmount.

export type TargetRect = {x: number; y: number; width: number; height: number};

const targetRefs = new Map<TourTargetId, RefObject<View | null>>();

export function registerTourTarget(
  id: TourTargetId,
  ref: RefObject<View | null>,
): () => void {
  targetRefs.set(id, ref);
  return () => {
    if (targetRefs.get(id) === ref) {
      targetRefs.delete(id);
    }
  };
}

/**
 * Measure a target in window coordinates. Resolves null when the target isn't
 * mounted (yet) or measures empty — callers retry across a few frames, since
 * the tour can start before Home has finished its first layout.
 */
export function measureTourTarget(
  id: TourTargetId,
): Promise<TargetRect | null> {
  return new Promise(resolve => {
    const node = targetRefs.get(id)?.current;
    if (node == null) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        resolve({x, y, width, height});
      } else {
        resolve(null);
      }
    });
  });
}
