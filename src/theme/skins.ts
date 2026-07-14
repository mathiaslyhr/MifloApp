/**
 * Skins — the app's visual identities. A skin bundles a colour `palette` with
 * the `appearance` axis it sits on (light/dark), which drives the blur tint
 * and the status-bar glyphs.
 *
 * SINGLE-SKIN REGISTRY. The old looks were removed for the visual reset; the
 * one `neutral` entry is a grayscale placeholder. The next skin replaces it
 * here (and its colors in `colors.ts`).
 */
import {neutral, type Palette} from './colors';

/** The shipping skins. New skins extend this union. */
export type SkinId = 'neutral';

/** The light/dark axis a skin sits on (drives chrome + status bar). */
export type Appearance = 'light' | 'dark';

export type Skin = {
  id: SkinId;
  /** Internal name (for us, not user-facing). */
  name: string;
  appearance: Appearance;
  palette: Palette;
};

export const SKINS: Record<SkinId, Skin> = {
  neutral: {
    id: 'neutral',
    name: 'Neutral',
    appearance: 'light',
    palette: neutral,
  },
};
