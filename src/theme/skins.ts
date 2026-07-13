/**
 * Skins — the app's visual identities. A skin bundles everything that gives a
 * look its character: a colour `palette` and the rainbow `mesh` behind the
 * glass. The user picks Light / Dark / System; internally those map to skins,
 * and this registry is the one place to add a new skin later (drop in another
 * entry with its palette + mesh and it's selectable).
 *
 * `appearance` is the light/dark axis every skin sits on — it drives the blur
 * tint, the status-bar glyphs, and which skin "System" resolves to. So a future
 * "Midnight" skin would still be `appearance: 'dark'`.
 */
import {dark, light, skin3 as skin3Palette, type Palette} from './colors';

/** The shipping skins. New skins extend this union. */
export type SkinId = 'light' | 'dark' | 'skin3';

/** The light/dark axis a skin sits on (for chrome + system-follow). */
export type Appearance = 'light' | 'dark';

/** One soft radial bloom in the mesh (rgb core + placement). */
export type Bloom = {
  rgb: string;
  alpha: number;
  cx: number; // 0–1 across the canvas
  cy: number; // 0–1 down the canvas
  scale: number; // multiplies the base ellipse radii (overlap ↑)
};

/** The rainbow canvas for a skin: a vertical wash + soft blooms over it. */
export type Mesh = {
  base: {offset: number; color: string}[];
  blooms: Bloom[];
};

export type Skin = {
  id: SkinId;
  /** Internal name (the user sees Light/Dark; this is for us). */
  name: string;
  appearance: Appearance;
  palette: Palette;
  mesh: Mesh;
};

/** Light "Daylight": the original 8-stop pastel wash + 7 alternating blooms. */
const DAYLIGHT_MESH: Mesh = {
  base: [
    {offset: 0, color: '#fdf2f7'}, // pink
    {offset: 0.15, color: '#f7e5ef'}, // rose
    {offset: 0.3, color: '#ece6f8'}, // purple
    {offset: 0.44, color: '#e1e7f7'}, // dark blue
    {offset: 0.57, color: '#e6f1fb'}, // light blue
    {offset: 0.7, color: '#e2f3ea'}, // green
    {offset: 0.84, color: '#f1f2d8'}, // yellow
    {offset: 1, color: '#f9e8d2'}, // orange
  ],
  blooms: [
    {rgb: '240,150,190', alpha: 0.26, cx: 0.25, cy: 0.03, scale: 1},
    {rgb: '150,148,240', alpha: 0.22, cx: 0.75, cy: 0.2, scale: 1},
    {rgb: '88,142,228', alpha: 0.26, cx: 0.25, cy: 0.35, scale: 1},
    {rgb: '150,200,245', alpha: 0.24, cx: 0.75, cy: 0.5, scale: 1},
    {rgb: '90,206,168', alpha: 0.26, cx: 0.25, cy: 0.66, scale: 1},
    {rgb: '244,220,140', alpha: 0.26, cx: 0.75, cy: 0.82, scale: 1},
    {rgb: '246,184,132', alpha: 0.28, cx: 0.25, cy: 0.94, scale: 1},
  ],
};

/** Dark "Aurora": near-black wash with big overlapping colour fields. */
const AURORA_MESH: Mesh = {
  base: [
    {offset: 0, color: '#120f1e'},
    {offset: 0.4, color: '#0f0d1a'},
    {offset: 0.72, color: '#0c0b15'},
    {offset: 1, color: '#0b0b12'},
  ],
  blooms: [
    {rgb: '210,120,205', alpha: 0.22, cx: 0.18, cy: 0.06, scale: 1.15}, // pink-purple
    {rgb: '96,140,238', alpha: 0.22, cx: 0.88, cy: 0.28, scale: 1.2}, // blue
    {rgb: '130,128,255', alpha: 0.12, cx: 0.5, cy: 0.48, scale: 1.15}, // purple, centre
    {rgb: '78,205,160', alpha: 0.2, cx: 0.16, cy: 0.66, scale: 1.15}, // green
    {rgb: '242,175,120', alpha: 0.22, cx: 0.86, cy: 0.9, scale: 1.2}, // orange
  ],
};

/**
 * Skin 3 — the new default look being built page by page (the redesign). Its
 * palette and mesh start as a copy of Aurora (a blank dark canvas) and get
 * repainted as each screen is rebuilt; nothing about the final aesthetic is
 * committed yet. Selectable in Settings, and the standard skin (see SYSTEM_SKIN).
 */
const SKIN3_MESH: Mesh = AURORA_MESH;

export const SKINS: Record<SkinId, Skin> = {
  light: {
    id: 'light',
    name: 'Daylight',
    appearance: 'light',
    palette: light,
    mesh: DAYLIGHT_MESH,
  },
  dark: {
    id: 'dark',
    name: 'Aurora',
    appearance: 'dark',
    palette: dark,
    mesh: AURORA_MESH,
  },
  skin3: {
    id: 'skin3',
    name: 'Skin 3',
    appearance: 'dark',
    palette: skin3Palette,
    mesh: SKIN3_MESH,
  },
};

/**
 * The skin "System" resolves to — skin 3 is the standard look now, so System
 * (the default preference) lands on it for both device appearances. Pick
 * Light/Dark explicitly in Settings to see the old skins.
 */
export const SYSTEM_SKIN: Record<Appearance, SkinId> = {
  light: 'skin3',
  dark: 'skin3',
};
