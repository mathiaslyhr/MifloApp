/**
 * The reactive skin layer. Holds the skin preference (Light / Dark / System) in
 * state, resolves it against the device color scheme, and hands the active
 * `Skin` to the tree.
 *
 * Screens read the active palette through `useColors()` and derive stylesheets
 * with `useThemedStyles(makeStyles)` so a skin change re-renders live — unlike
 * the static `import {colors}`, which bakes the light values at module load.
 * Chrome that needs the mesh or the light/dark axis reads the whole skin via
 * `useSkin()`.
 *
 * On first render the preference is the synchronous default (`system`, so we
 * follow the device); the stored override loads a tick later and updates, the
 * same boot pattern as language (`core/i18n`).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {useColorScheme} from 'react-native';
import type {Palette} from './colors';
import {SKINS, type Skin} from './skins';
import {
  getSkinPreference,
  resolveSkin,
  setSkinPreference,
  type SkinPreference,
} from '../core/settings/skinPreference';

type SkinContextValue = {
  /** The active skin (palette + mesh + appearance). */
  skin: Skin;
  /** The active palette (shortcut for `skin.palette`). */
  colors: Palette;
  /** What the user picked (concrete skin or "follow system"). */
  preference: SkinPreference;
  /** Persist + apply a new preference; re-renders the tree live. */
  setPreference: (pref: SkinPreference) => Promise<void>;
};

const SkinContext = createContext<SkinContextValue | null>(null);

export function SkinProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<SkinPreference>('system');

  // Apply the saved override on boot (system is the synchronous default).
  useEffect(() => {
    getSkinPreference()
      .then(setPreferenceState)
      .catch(() => {});
  }, []);

  const skin = SKINS[resolveSkin(preference, systemScheme)];

  const setPreference = useCallback(async (pref: SkinPreference) => {
    // Apply first so it always takes for this session; persist may still fail.
    setPreferenceState(pref);
    await setSkinPreference(pref);
  }, []);

  const value = useMemo<SkinContextValue>(
    () => ({skin, colors: skin.palette, preference, setPreference}),
    [skin, preference, setPreference],
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

/**
 * Read the skin context, or a light-skin fallback when there's no provider (a
 * component rendered in isolation — e.g. a unit test — or before the tree is
 * wrapped). This mirrors the old static `colors` behavior, so nothing has to
 * mount a provider just to render.
 */
const FALLBACK: SkinContextValue = {
  skin: SKINS.light,
  colors: SKINS.light.palette,
  preference: 'system',
  setPreference: async () => {},
};

function useSkinContext(): SkinContextValue {
  return useContext(SkinContext) ?? FALLBACK;
}

/** Full skin state — the active skin, preference, and the setter (the picker). */
export function useSkin(): SkinContextValue {
  return useSkinContext();
}

/** The active palette. Use in JSX props: `color={useColors().primary}`. */
export function useColors(): Palette {
  return useSkinContext().colors;
}

/**
 * Derive a themed StyleSheet. Pass a module-level factory so it stays stable;
 * the result is memoized and only rebuilt when the active palette changes.
 *
 *   const makeStyles = (c: Palette) => StyleSheet.create({box: {backgroundColor: c.surface}});
 *   // in the component:
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
