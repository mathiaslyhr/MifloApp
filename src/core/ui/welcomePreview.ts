/**
 * Welcome-screen preview — lets a signed-in device re-open the onboarding
 * front door (Welcome → Quick setup / Enter code) as a full-screen overlay,
 * for reviewing the flows without deleting the profile.
 *
 * A tiny Zustand store (same pattern as the toast store) so Settings can open
 * it imperatively while the overlay itself is mounted at the app root.
 */
import {create} from 'zustand';

type WelcomePreviewState = {
  visible: boolean;
  open: () => void;
  close: () => void;
};

export const useWelcomePreview = create<WelcomePreviewState>(set => ({
  visible: false,
  open: () => set({visible: true}),
  close: () => set({visible: false}),
}));
