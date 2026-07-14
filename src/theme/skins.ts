/**
 * Skins — the app's visual identities. A skin bundles a colour `palette` with
 * the `appearance` axis it sits on (light/dark), which drives the blur tint
 * and the status-bar glyphs.
 *
 * Single-skin registry: Skin 1, the dark elevation-by-brightness system
 * (spec: docs/design.md). A future skin extends the union and adds an entry.
 */
import {skin1, type Palette} from './colors';

/** The shipping skins. New skins extend this union. */
export type SkinId = 'skin1';

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
  skin1: {
    id: 'skin1',
    name: 'Skin 1',
    appearance: 'dark',
    palette: skin1,
  },
};
